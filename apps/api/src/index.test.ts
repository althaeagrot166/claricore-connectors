import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  attachSecretToConnection: vi.fn(), createConnection: vi.fn(), createJob: vi.fn(), createSchedule: vi.fn(), getConnection: vi.fn(), getJob: vi.fn(), listConnections: vi.fn(),
  resetCheckpoint: vi.fn(), setConnectionStatus: vi.fn(), setScheduleActive: vi.fn()
};
const queue = { enqueueSyncJob: vi.fn() };
const secretManager = { storeSecret: vi.fn() };
vi.mock("@claricore/db", () => db); vi.mock("@claricore/queue", () => queue); vi.mock("@claricore/secret-manager", () => secretManager);
vi.mock("@claricore/config", () => ({ getConfig: () => ({ port: 4000, apiKey: "dev-api-key" }) }));

import { createApiServer } from "./index";

describe("api routes", () => {
  let server: ReturnType<typeof createApiServer>; let port = 0;
  const headers = { "content-type": "application/json", "x-org-id": "org-1", "x-api-key": "dev-api-key" };
  beforeEach(async () => { Object.values(db).forEach((fn: any) => fn.mockReset?.()); queue.enqueueSyncJob.mockReset(); server = createApiServer(); await new Promise<void>((r) => server.listen(0, "127.0.0.1", r)); const a = server.address(); if (!a || typeof a === "string") throw new Error("bad"); port = a.port; });
  afterEach(async () => { await new Promise<void>((r) => server.close(() => r())); });

  it("requires org auth headers", async () => { const res = await fetch(`http://127.0.0.1:${port}/connections`); expect(res.status).toBe(401); });
  it("supports pause and resume", async () => {
    await fetch(`http://127.0.0.1:${port}/connections/c1/pause`, { method: "POST", headers });
    expect(db.setConnectionStatus).toHaveBeenCalledWith("org-1", "c1", "paused");
    await fetch(`http://127.0.0.1:${port}/connections/c1/resume`, { method: "POST", headers });
    expect(db.setConnectionStatus).toHaveBeenCalledWith("org-1", "c1", "active");
  });
});
