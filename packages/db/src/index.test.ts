import { beforeEach, describe, expect, it, vi } from "vitest";
const query = vi.fn();
vi.mock("./client", () => ({ pool: { query } }));
import { createConnection, createJob, updateJobStatus } from "./index";

describe("db query layer", () => {
  beforeEach(() => query.mockReset());
  it("creates connection with org scope", async () => {
    query.mockResolvedValue({ rows: [{ id: "c1", orgId: "o1" }] });
    await createConnection({ orgId: "o1", connectorType: "salesforce", name: "SF", syncMode: "incremental" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO connections"), ["o1", "salesforce", "SF", "incremental"]);
  });
  it("creates sync job", async () => {
    query.mockResolvedValue({ rows: [{ id: "j1" }] });
    await createJob({ orgId: "o1", connectionId: "c1", connectorType: "salesforce", mode: "full" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO sync_jobs"), ["o1", "c1", "salesforce", "full", null]);
  });
  it("updates job status", async () => {
    query.mockResolvedValue({ rows: [] });
    await updateJobStatus("o1", "j1", "failed", "boom");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("UPDATE sync_jobs SET status"), ["o1", "j1", "failed", "boom"]);
  });
});
