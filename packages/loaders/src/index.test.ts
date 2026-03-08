import fs from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { JsonlFileLoader, HttpIngestionLoader } from "./index";

async function* records() { yield { id: 1 }; yield { id: 2 }; }

describe("loaders", () => {
  it("writes JSONL records", async () => {
    const file = "./tmp/test-loader.jsonl";
    await fs.rm(file, { force: true });
    const loader = new JsonlFileLoader({ type: "jsonl", jsonlPath: file });
    const result = await loader.load({ orgId: "o1", connectionId: "c1", runId: "r1" }, records());
    expect(result.loadedCount).toBe(2);
  });

  it("posts batches over HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const loader = new HttpIngestionLoader({ type: "http", httpBaseUrl: "http://x", batchSize: 1 });
    await loader.load({ orgId: "o1", connectionId: "c1", runId: "r1" }, records());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
