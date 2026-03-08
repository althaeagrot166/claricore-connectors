import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { getConfig } from "@claricore/config";
import { attachSecretToConnection, createConnection, createJob, createSchedule, getConnection, getJob, listConnections, resetCheckpoint, setConnectionStatus, setScheduleActive } from "@claricore/db";
import { createLogger, setupTelemetry, metrics } from "@claricore/observability";
import { enqueueSyncJob } from "@claricore/queue";
import { connectorRegistry } from "@claricore/registry";
import { storeSecret } from "@claricore/secret-manager";
import { createConnectionRequestSchema, scheduleRequestSchema, triggerSyncRequestSchema } from "@claricore/ui-contracts";

const logger = createLogger({ service: "api" });
class InvalidJsonError extends Error { constructor() { super("Invalid JSON body"); } }
function sendJson(res: ServerResponse, status: number, data: unknown): void { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data, null, 2)); }
async function readJsonBody(req: IncomingMessage): Promise<unknown> { const chunks: Buffer[] = []; for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); const raw = Buffer.concat(chunks).toString("utf8"); if (!raw) return {}; try { return JSON.parse(raw); } catch { throw new InvalidJsonError(); } }

function getOrgContext(req: IncomingMessage): { orgId: string } | null {
  const orgId = req.headers["x-org-id"];
  const apiKey = req.headers["x-api-key"];
  const cfg = getConfig();
  if (typeof orgId !== "string" || typeof apiKey !== "string" || apiKey !== cfg.apiKey) return null;
  return { orgId };
}

export function createApiServer(): Server {
  return createServer(async (req, res) => {
    try {
      const url = req.url ?? "/"; const method = req.method ?? "GET";
      if (method === "GET" && url === "/health") return sendJson(res, 200, { ok: true, service: "api" });
      const auth = getOrgContext(req); if (!auth) return sendJson(res, 401, { error: "Missing/invalid x-org-id or x-api-key" });

      if (method === "GET" && url === "/connectors") return sendJson(res, 200, { data: connectorRegistry });
      if (method === "GET" && url === "/connections") return sendJson(res, 200, { data: await listConnections(auth.orgId) });
      if (method === "POST" && url === "/connections") {
        const parsed = createConnectionRequestSchema.parse(await readJsonBody(req));
        const connection = await createConnection({ ...parsed, orgId: auth.orgId });
        if (parsed.credentials) { const secretId = await storeSecret(auth.orgId, connection.id, parsed.credentials); await attachSecretToConnection(auth.orgId, connection.id, secretId); }
        logger.info("audit.connection_created", { orgId: auth.orgId, connectionId: connection.id });
        return sendJson(res, 201, { data: connection });
      }

      const syncMatch = url.match(/^\/connections\/([^/]+)\/sync$/);
      if (method === "POST" && syncMatch) {
        const connectionId = syncMatch[1]; const connection = await getConnection(auth.orgId, connectionId); if (!connection) return sendJson(res, 404, { error: "Connection not found" });
        const parsed = triggerSyncRequestSchema.parse(await readJsonBody(req)); const job = await createJob({ orgId: auth.orgId, connectionId, connectorType: connection.connectorType, mode: parsed.mode, resource: parsed.resource });
        await enqueueSyncJob({ orgId: auth.orgId, jobId: job.id, connectionId, connectorType: connection.connectorType, mode: parsed.mode, resource: parsed.resource, source: "api" });
        logger.info("audit.sync_trigger", { orgId: auth.orgId, connectionId, jobId: job.id }); metrics.increment("sync_jobs_started", 1, { orgId: auth.orgId });
        return sendJson(res, 202, { data: job });
      }

      const retryMatch = url.match(/^\/jobs\/([^/]+)\/retry$/);
      if (method === "POST" && retryMatch) {
        const existing = await getJob(auth.orgId, retryMatch[1]); if (!existing) return sendJson(res, 404, { error: "Job not found" });
        const retried = await createJob({ orgId: auth.orgId, connectionId: existing.connectionId, connectorType: existing.connectorType, mode: existing.mode, resource: existing.resource });
        await enqueueSyncJob({ orgId: auth.orgId, jobId: retried.id, connectionId: existing.connectionId, connectorType: existing.connectorType, mode: existing.mode, resource: existing.resource, source: "retry" });
        return sendJson(res, 202, { data: retried });
      }

      if (method === "POST" && url === "/schedules") {
        const parsed = scheduleRequestSchema.parse(await readJsonBody(req));
        const schedule = await createSchedule(auth.orgId, parsed.connectionId, parsed.cron, parsed.resource);
        logger.info("audit.schedule_created", { orgId: auth.orgId, scheduleId: schedule.id });
        return sendJson(res, 201, { data: schedule });
      }

      const control = async (re: RegExp, fn: (id: string)=>Promise<void>) => { const m = url.match(re); if (method === "POST" && m) { await fn(m[1]); return true; } return false; };
      if (await control(/^\/connections\/([^/]+)\/pause$/, (id)=>setConnectionStatus(auth.orgId,id,"paused"))) return sendJson(res, 200, { ok: true });
      if (await control(/^\/connections\/([^/]+)\/resume$/, (id)=>setConnectionStatus(auth.orgId,id,"active"))) return sendJson(res, 200, { ok: true });
      if (await control(/^\/connections\/([^/]+)\/checkpoints\/reset$/, (id)=>resetCheckpoint(auth.orgId,id,"Account"))) return sendJson(res, 200, { ok: true });
      if (await control(/^\/schedules\/([^/]+)\/enable$/, (id)=>setScheduleActive(auth.orgId,id,true))) return sendJson(res, 200, { ok: true });
      if (await control(/^\/schedules\/([^/]+)\/disable$/, (id)=>setScheduleActive(auth.orgId,id,false))) return sendJson(res, 200, { ok: true });

      const jobMatch = url.match(/^\/jobs\/([^/]+)$/); if (method === "GET" && jobMatch) { const job = await getJob(auth.orgId, jobMatch[1]); if (!job) return sendJson(res, 404, { error: "Job not found" }); return sendJson(res, 200, { data: job }); }
      return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      if (error instanceof InvalidJsonError) return sendJson(res, 400, { error: error.message });
      if (error instanceof ZodError) return sendJson(res, 400, { error: "Validation failed", details: error.issues });
      return sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown server error" });
    }
  });
}

if (process.env.NODE_ENV !== "test") {
  const config = getConfig(); void setupTelemetry("api", config.otelEndpoint, config.otelHeaders);
  const server = createApiServer(); let shuttingDown = false;
  server.listen(config.port, () => logger.info("service started", { port: config.port }));
  const shutdown = () => { if (shuttingDown) return; shuttingDown = true; logger.info("graceful shutdown requested"); server.close(() => process.exit(0)); };
  process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
}
