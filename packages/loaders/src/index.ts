import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type { LoadContext, LoadResult } from "@claricore/core";
import { logInfo } from "@claricore/observability";

export interface DestinationLoader {
  load(ctx: LoadContext, records: AsyncGenerator<Record<string, unknown>>): Promise<LoadResult>;
}

export interface LoaderConfig {
  type: "http" | "jsonl" | "postgres";
  batchSize?: number;
  httpBaseUrl?: string;
  httpToken?: string;
  jsonlPath?: string;
  postgresUrl?: string;
}

export class HttpIngestionLoader implements DestinationLoader {
  constructor(private readonly cfg: LoaderConfig) {}
  async load(ctx: LoadContext, records: AsyncGenerator<Record<string, unknown>>): Promise<LoadResult> {
    let loadedCount = 0;
    const batchSize = this.cfg.batchSize ?? 100;
    let batch: Record<string, unknown>[] = [];
    for await (const record of records) {
      batch.push(record);
      if (batch.length >= batchSize) {
        await this.flush(ctx, batch);
        loadedCount += batch.length;
        batch = [];
      }
    }
    if (batch.length) { await this.flush(ctx, batch); loadedCount += batch.length; }
    return { loadedCount, destination: "claricore-http" };
  }
  private async flush(ctx: LoadContext, batch: Record<string, unknown>[]) {
    // TODO(contract): final Claricore ingestion contract may differ; this endpoint is env-configurable.
    await fetch(`${this.cfg.httpBaseUrl}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.httpToken ?? ""}` },
      body: JSON.stringify({ orgId: ctx.orgId, connectionId: ctx.connectionId, runId: ctx.runId, resource: ctx.resource, records: batch })
    });
    logInfo("load.batch", { destination: "http", batchSize: batch.length, orgId: ctx.orgId, connectionId: ctx.connectionId, runId: ctx.runId });
  }
}

export class JsonlFileLoader implements DestinationLoader {
  constructor(private readonly cfg: LoaderConfig) {}
  async load(ctx: LoadContext, records: AsyncGenerator<Record<string, unknown>>): Promise<LoadResult> {
    const output = this.cfg.jsonlPath ?? "./tmp/claricore-output.jsonl";
    await fs.mkdir(path.dirname(output), { recursive: true });
    let loadedCount = 0;
    for await (const record of records) {
      await fs.appendFile(output, `${JSON.stringify({ ...record, _meta: ctx })}\n`);
      loadedCount += 1;
    }
    logInfo("load.batch", { destination: "jsonl", batchSize: loadedCount, orgId: ctx.orgId, connectionId: ctx.connectionId, runId: ctx.runId });
    return { loadedCount, destination: "jsonl" };
  }
}

export class PostgresDestinationLoader implements DestinationLoader {
  private readonly pool: Pool;
  constructor(private readonly cfg: LoaderConfig) { this.pool = new Pool({ connectionString: cfg.postgresUrl }); }
  async load(ctx: LoadContext, records: AsyncGenerator<Record<string, unknown>>): Promise<LoadResult> {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS destination_records (id UUID DEFAULT gen_random_uuid(), org_id TEXT, connection_id TEXT, run_id TEXT, resource TEXT, record JSONB, created_at TIMESTAMPTZ DEFAULT NOW())`);
    let loadedCount = 0;
    for await (const record of records) {
      await this.pool.query(`INSERT INTO destination_records (org_id, connection_id, run_id, resource, record) VALUES ($1,$2,$3,$4,$5)`, [ctx.orgId, ctx.connectionId, ctx.runId, ctx.resource ?? null, JSON.stringify(record)]);
      loadedCount += 1;
    }
    logInfo("load.batch", { destination: "postgres", batchSize: loadedCount, orgId: ctx.orgId, connectionId: ctx.connectionId, runId: ctx.runId });
    return { loadedCount, destination: "postgres" };
  }
}

export function createLoader(cfg: LoaderConfig): DestinationLoader {
  if (cfg.type === "jsonl") return new JsonlFileLoader(cfg);
  if (cfg.type === "postgres") return new PostgresDestinationLoader(cfg);
  return new HttpIngestionLoader(cfg);
}
