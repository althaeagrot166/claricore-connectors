import { createServer } from "node:http";
import { createSyncWorker, enqueueDeadLetter, type SyncQueuePayload } from "@claricore/queue";
import { getCheckpoint, upsertCheckpoint } from "@claricore/checkpoints";
import { getConnection, updateJobStatus } from "@claricore/db";
import { createLoader, type DestinationLoader } from "@claricore/loaders";
import { createLogger, metrics, startSpan, setupTelemetry } from "@claricore/observability";
import { mapSalesforceAccount } from "@claricore/transformations";
import { SalesforceConnector } from "@claricore/connector-salesforce";
import { getConfig } from "@claricore/config";
import type { Job } from "bullmq";

const logger = createLogger({ service: "worker" });

export function createWorkerProcessor(deps?: {
  getConnection?: typeof getConnection;
  updateJobStatus?: typeof updateJobStatus;
  getCheckpoint?: typeof getCheckpoint;
  upsertCheckpoint?: typeof upsertCheckpoint;
  enqueueDeadLetter?: typeof enqueueDeadLetter;
  loader?: Pick<DestinationLoader, "load">;
  connectorFactory?: () => { extract: SalesforceConnector["extract"] };
}) {
  const config = getConfig();
  const loader = deps?.loader ?? createLoader({ type: config.loaderType, batchSize: config.loaderBatchSize, httpBaseUrl: config.claricoreIngestionBaseUrl, httpToken: config.claricoreIngestionToken, jsonlPath: config.jsonlOutputPath, postgresUrl: config.databaseUrl });

  return async (job: Job<SyncQueuePayload>) => {
    const payload = job.data;
    const span = startSpan("sync-job", { orgId: payload.orgId, connectionId: payload.connectionId, jobId: payload.jobId, connectorType: payload.connectorType, resource: payload.resource ?? "Account" });
    const started = Date.now();
    const dbGetConnection = deps?.getConnection ?? getConnection;
    const dbUpdateJobStatus = deps?.updateJobStatus ?? updateJobStatus;
    const dbGetCheckpoint = deps?.getCheckpoint ?? getCheckpoint;
    const dbUpsertCheckpoint = deps?.upsertCheckpoint ?? upsertCheckpoint;
    const dlq = deps?.enqueueDeadLetter ?? enqueueDeadLetter;

    await dbUpdateJobStatus(payload.orgId, payload.jobId, "running");
    try {
      const connection = await dbGetConnection(payload.orgId, payload.connectionId);
      if (!connection) throw new Error(`Connection ${payload.connectionId} not found`);
      if (connection.status === "paused") {
        await dbUpdateJobStatus(payload.orgId, payload.jobId, "completed", "ignored: connection paused");
        return;
      }

      const connector = deps?.connectorFactory?.() ?? new SalesforceConnector();
      const checkpoint = await dbGetCheckpoint(payload.orgId, payload.connectionId, payload.resource ?? "Account");
      const rawRecords = connector.extract({ orgId: payload.orgId, connectionId: payload.connectionId, runId: payload.jobId, mode: payload.mode, resource: payload.resource, checkpoint, config: {} });
      async function* transformed() { for await (const record of rawRecords) yield mapSalesforceAccount(record); }
      const result = await loader.load({ orgId: payload.orgId, connectionId: payload.connectionId, runId: payload.jobId, resource: payload.resource, destination: "claricore" }, transformed());
      await dbUpsertCheckpoint({ orgId: payload.orgId, connectionId: payload.connectionId, resource: payload.resource ?? "Account", cursor: new Date().toISOString() });
      await dbUpdateJobStatus(payload.orgId, payload.jobId, "completed", null);
      metrics.increment("sync_jobs_completed", 1, { connectorType: payload.connectorType });
      metrics.timing("load_duration_ms", Date.now() - started, { connectorType: payload.connectorType });
      logger.info("job completed", { orgId: payload.orgId, connectionId: payload.connectionId, jobId: payload.jobId, loadedCount: result.loadedCount });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await dbUpdateJobStatus(payload.orgId, payload.jobId, "failed", message);
      metrics.increment("sync_jobs_failed", 1, { connectorType: payload.connectorType });
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) { await dlq(payload); metrics.increment("dlq_jobs_total", 1); }
      throw error;
    } finally { span.end(); }
  };
}

if (process.env.NODE_ENV !== "test") {
  const config = getConfig(); void setupTelemetry("worker", config.otelEndpoint, config.otelHeaders);
  const worker = createSyncWorker(createWorkerProcessor());
  const healthServer = createServer((req, res) => { if (req.url !== "/health") { res.writeHead(404).end(JSON.stringify({ error: "Not found" })); return; } res.writeHead(200).end(JSON.stringify({ ok: true, service: "worker" })); });
  healthServer.listen(config.workerHealthPort, () => logger.info("health server started", { port: config.workerHealthPort }));
  let shuttingDown = false;
  const shutdown = async () => { if (shuttingDown) return; shuttingDown = true; await worker.close(); healthServer.close(() => process.exit(0)); };
  process.on("SIGINT", () => void shutdown()); process.on("SIGTERM", () => void shutdown());
}
