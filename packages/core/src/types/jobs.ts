import type { Checkpoint } from "./checkpoint";

export interface ExtractContext {
  orgId: string;
  connectionId: string;
  runId: string;
  mode: "full" | "incremental";
  resource?: string;
  checkpoint?: Checkpoint | null;
  config?: Record<string, unknown>;
}

export interface LoadContext {
  orgId: string;
  connectionId: string;
  runId: string;
  resource?: string;
  destination?: string;
}

export interface LoadResult {
  loadedCount: number;
  destination: string;
}

export interface SyncJob {
  id: string;
  orgId: string;
  connectionId: string;
  connectorType: string;
  mode: "full" | "incremental";
  status: "queued" | "running" | "completed" | "failed";
  resource?: string;
  createdAt: string;
  updatedAt?: string;
  errorMessage?: string | null;
}

export interface CreateSyncJobInput {
  orgId: string;
  connectionId: string;
  connectorType: string;
  mode: "full" | "incremental";
  resource?: string;
}

export interface RetryPolicy {
  attempts: number;
  backoffMs: number;
}

export interface DeadLetterPayload {
  jobId: string;
  reason: string;
  payload: Record<string, unknown>;
}
