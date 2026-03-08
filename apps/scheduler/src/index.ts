import { createServer } from "node:http";
import cron, { type ScheduledTask } from "node-cron";
import { createJob, getConnection, listSchedules } from "@claricore/db";
import { createLogger, setupTelemetry } from "@claricore/observability";
import { enqueueSyncJob } from "@claricore/queue";
import { getConfig } from "@claricore/config";

const logger = createLogger({ service: "scheduler" });

export async function bootstrapScheduler(): Promise<{ stop: () => void }> {
  const schedules = await listSchedules();
  const tasks: ScheduledTask[] = [];
  for (const schedule of schedules) {
    const task = cron.schedule(schedule.cron, async () => {
      try {
        const connection = await getConnection(schedule.orgId, schedule.connectionId);
        if (!connection || connection.status === "paused") return;
        const job = await createJob({ orgId: schedule.orgId, connectionId: schedule.connectionId, connectorType: connection.connectorType, mode: "incremental", resource: schedule.resource });
        await enqueueSyncJob({ orgId: schedule.orgId, jobId: job.id, connectionId: schedule.connectionId, connectorType: connection.connectorType, mode: "incremental", resource: schedule.resource, source: "scheduler" });
        logger.info("scheduled sync enqueued", { orgId: schedule.orgId, scheduleId: schedule.id, jobId: job.id });
      } catch (error) {
        logger.error("scheduled sync failed", { error: error instanceof Error ? error.message : String(error) });
      }
    });
    tasks.push(task);
  }
  return { stop: () => tasks.forEach((task) => task.stop()) };
}

if (process.env.NODE_ENV !== "test") {
  const config = getConfig(); void setupTelemetry("scheduler", config.otelEndpoint, config.otelHeaders);
  const healthServer = createServer((req, res) => { if (req.url !== "/health") return res.writeHead(404).end(); res.writeHead(200).end(JSON.stringify({ ok: true, service: "scheduler" })); });
  healthServer.listen(config.schedulerHealthPort);
  let stop: (() => void) | undefined; void bootstrapScheduler().then((runner) => { stop = runner.stop; });
  const shutdown = () => { stop?.(); healthServer.close(() => process.exit(0)); };
  process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
}
