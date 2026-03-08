import type { CreateConnectionInput, Connection, CreateSyncJobInput, SyncJob, Checkpoint } from "@claricore/core";
import { pool } from "./client";

export interface OrgScopedInput { orgId: string; }

export async function createConnection(input: CreateConnectionInput): Promise<Connection> {
  const result = await pool.query(
    `INSERT INTO connections (org_id, connector_type, name, sync_mode)
     VALUES ($1, $2, $3, $4)
     RETURNING id, org_id AS "orgId", connector_type AS "connectorType", name, status, sync_mode AS "syncMode", config_secret_id AS "configSecretId", created_at AS "createdAt"`,
    [input.orgId, input.connectorType, input.name, input.syncMode]
  );
  return result.rows[0] as Connection;
}

export async function attachSecretToConnection(orgId: string, connectionId: string, secretId: string): Promise<void> {
  await pool.query(`UPDATE connections SET config_secret_id = $3 WHERE id = $2 AND org_id = $1`, [orgId, connectionId, secretId]);
}

export async function getConnection(orgId: string, id: string): Promise<Connection | undefined> {
  const result = await pool.query(
    `SELECT id, org_id AS "orgId", connector_type AS "connectorType", name, status, sync_mode AS "syncMode", config_secret_id AS "configSecretId", created_at AS "createdAt"
     FROM connections WHERE org_id = $1 AND id = $2`, [orgId, id]
  );
  return result.rows[0] as Connection | undefined;
}

export async function listConnections(orgId: string): Promise<Connection[]> {
  const result = await pool.query(
    `SELECT id, org_id AS "orgId", connector_type AS "connectorType", name, status, sync_mode AS "syncMode", config_secret_id AS "configSecretId", created_at AS "createdAt"
     FROM connections WHERE org_id = $1 ORDER BY created_at DESC`, [orgId]
  );
  return result.rows as Connection[];
}

export async function setConnectionStatus(orgId: string, connectionId: string, status: "active" | "paused"): Promise<void> {
  await pool.query(`UPDATE connections SET status = $3 WHERE org_id = $1 AND id = $2`, [orgId, connectionId, status]);
}

export async function createJob(input: CreateSyncJobInput): Promise<SyncJob> {
  const result = await pool.query(
    `INSERT INTO sync_jobs (org_id, connection_id, connector_type, mode, status, resource)
     VALUES ($1, $2, $3, $4, 'queued', $5)
     RETURNING id, org_id AS "orgId", connection_id AS "connectionId", connector_type AS "connectorType", mode, status, resource, created_at AS "createdAt", updated_at AS "updatedAt", error_message AS "errorMessage"`,
    [input.orgId, input.connectionId, input.connectorType, input.mode, input.resource ?? null]
  );
  return result.rows[0] as SyncJob;
}

export async function getJob(orgId: string, id: string): Promise<SyncJob | undefined> {
  const result = await pool.query(
    `SELECT id, org_id AS "orgId", connection_id AS "connectionId", connector_type AS "connectorType", mode, status, resource, created_at AS "createdAt", updated_at AS "updatedAt", error_message AS "errorMessage"
     FROM sync_jobs WHERE org_id = $1 AND id = $2`, [orgId, id]
  );
  return result.rows[0] as SyncJob | undefined;
}

export async function updateJobStatus(orgId: string, id: string, status: SyncJob["status"], errorMessage?: string | null): Promise<void> {
  await pool.query(`UPDATE sync_jobs SET status = $3, error_message = $4, updated_at = NOW() WHERE org_id = $1 AND id = $2`, [orgId, id, status, errorMessage ?? null]);
}

export async function upsertCheckpoint(checkpoint: Checkpoint): Promise<void> {
  await pool.query(
    `INSERT INTO checkpoints (org_id, connection_id, resource, cursor, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (org_id, connection_id, resource)
     DO UPDATE SET cursor = EXCLUDED.cursor, updated_at = NOW()`,
    [checkpoint.orgId, checkpoint.connectionId, checkpoint.resource, checkpoint.cursor ?? null]
  );
}

export async function getCheckpoint(orgId: string, connectionId: string, resource: string): Promise<Checkpoint | null> {
  const result = await pool.query(
    `SELECT org_id AS "orgId", connection_id AS "connectionId", resource, cursor, updated_at AS "updatedAt"
     FROM checkpoints WHERE org_id = $1 AND connection_id = $2 AND resource = $3`,
    [orgId, connectionId, resource]
  );
  return (result.rows[0] as Checkpoint | undefined) ?? null;
}

export async function resetCheckpoint(orgId: string, connectionId: string, resource: string): Promise<void> {
  await pool.query(`DELETE FROM checkpoints WHERE org_id = $1 AND connection_id = $2 AND resource = $3`, [orgId, connectionId, resource]);
}

export async function createSchedule(orgId: string, connectionId: string, cron: string, resource?: string): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO schedules (org_id, connection_id, cron, resource) VALUES ($1, $2, $3, $4) RETURNING id`,
    [orgId, connectionId, cron, resource ?? null]
  );
  return result.rows[0] as { id: string };
}

export async function setScheduleActive(orgId: string, scheduleId: string, active: boolean): Promise<void> {
  await pool.query(`UPDATE schedules SET active = $3 WHERE org_id = $1 AND id = $2`, [orgId, scheduleId, active]);
}

export async function listSchedules(orgId?: string): Promise<Array<{ id: string; orgId: string; connectionId: string; cron: string; resource?: string }>> {
  const result = orgId
    ? await pool.query(`SELECT id, org_id AS "orgId", connection_id AS "connectionId", cron, resource FROM schedules WHERE org_id = $1 AND active = TRUE`, [orgId])
    : await pool.query(`SELECT id, org_id AS "orgId", connection_id AS "connectionId", cron, resource FROM schedules WHERE active = TRUE`);
  return result.rows;
}

export async function saveWebhookEvent(input: { orgId: string; connectorType: string; connectionId?: string; eventType: string; resource?: string; payload: unknown }): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO webhook_events (org_id, connector_type, connection_id, event_type, resource, payload)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.orgId, input.connectorType, input.connectionId ?? null, input.eventType, input.resource ?? null, JSON.stringify(input.payload)]
  );
  return result.rows[0] as { id: string };
}
