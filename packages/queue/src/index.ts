import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { getConfig } from "@claricore/config";

export interface SyncQueuePayload {
  orgId: string;
  jobId: string;
  connectionId: string;
  connectorType: string;
  mode: "full" | "incremental";
  resource?: string;
  source?: "api" | "scheduler" | "webhook" | "retry";
}

const config = getConfig();
const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const syncQueue = new Queue<SyncQueuePayload>(config.queueName, { connection });
export const deadLetterQueue = new Queue<SyncQueuePayload>(`${config.queueName}-dlq`, { connection });

export async function enqueueSyncJob(payload: SyncQueuePayload): Promise<void> {
  await syncQueue.add("sync", payload, { attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 100, removeOnFail: 100 });
}

export async function enqueueDeadLetter(payload: SyncQueuePayload): Promise<void> {
  await deadLetterQueue.add("sync-dlq", payload, { removeOnComplete: 100, removeOnFail: 100 });
}

export async function replayDeadLetterJobs(limit = 50): Promise<number> {
  const jobs = await deadLetterQueue.getJobs(["waiting", "failed", "delayed"], 0, limit - 1);
  for (const j of jobs) {
    await enqueueSyncJob({ ...j.data, source: "retry" });
    await j.remove();
  }
  return jobs.length;
}

export function createSyncWorker(processor: (job: Job<SyncQueuePayload>) => Promise<void>): Worker<SyncQueuePayload> {
  return new Worker<SyncQueuePayload>(config.queueName, processor, { connection });
}
