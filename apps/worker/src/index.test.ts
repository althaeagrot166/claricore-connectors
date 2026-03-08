import { describe, expect, it, vi } from "vitest";
import { createWorkerProcessor } from "./index";

type TestJob = { data: { orgId: string; jobId: string; connectionId: string; connectorType: string; mode: "full" | "incremental"; source: "api" | "scheduler" | "webhook" }; attemptsMade: number; opts: { attempts?: number } };
function makeJob(overrides?: Partial<TestJob>): TestJob { return { data: { orgId: "o1", jobId: "j1", connectionId: "c1", connectorType: "salesforce", mode: "incremental", source: "api", ...overrides?.data }, attemptsMade: overrides?.attemptsMade ?? 0, opts: overrides?.opts ?? { attempts: 1 } }; }

describe("worker flows", () => {
  it("handles successful sync", async () => {
    const updateJobStatus = vi.fn();
    const processor = createWorkerProcessor({ getConnection: vi.fn().mockResolvedValue({ id: "c1", connectorType: "salesforce", status: "active" }), updateJobStatus, getCheckpoint: vi.fn().mockResolvedValue(null), upsertCheckpoint: vi.fn(), loader: { load: vi.fn().mockResolvedValue({ loadedCount: 1 }) }, connectorFactory: () => ({ async *extract() { yield { id: "001", name: "Acme" }; } }) });
    await processor(makeJob() as never);
    expect(updateJobStatus).toHaveBeenNthCalledWith(1, "o1", "j1", "running");
    expect(updateJobStatus).toHaveBeenLastCalledWith("o1", "j1", "completed", null);
  });

  it("ignores paused connection", async () => {
    const updateJobStatus = vi.fn();
    const processor = createWorkerProcessor({ getConnection: vi.fn().mockResolvedValue({ id: "c1", connectorType: "salesforce", status: "paused" }), updateJobStatus, getCheckpoint: vi.fn(), upsertCheckpoint: vi.fn(), loader: { load: vi.fn() } });
    await processor(makeJob() as never);
    expect(updateJobStatus).toHaveBeenLastCalledWith("o1", "j1", "completed", "ignored: connection paused");
  });
});
