ALTER TABLE connections ADD COLUMN IF NOT EXISTS org_id TEXT;
UPDATE connections SET org_id = COALESCE(org_id, 'dev-org');
ALTER TABLE connections ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connections_org_id ON connections(org_id);

ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS org_id TEXT;
UPDATE sync_jobs sj SET org_id = c.org_id FROM connections c WHERE sj.connection_id = c.id;
UPDATE sync_jobs SET org_id = COALESCE(org_id, 'dev-org');
ALTER TABLE sync_jobs ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_jobs_org_id ON sync_jobs(org_id);

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS org_id TEXT;
UPDATE schedules s SET org_id = c.org_id FROM connections c WHERE s.connection_id = c.id;
UPDATE schedules SET org_id = COALESCE(org_id, 'dev-org');
ALTER TABLE schedules ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_org_id ON schedules(org_id);

ALTER TABLE connection_secrets ADD COLUMN IF NOT EXISTS org_id TEXT;
UPDATE connection_secrets cs SET org_id = c.org_id FROM connections c WHERE cs.connection_id = c.id;
UPDATE connection_secrets SET org_id = COALESCE(org_id, 'dev-org');
ALTER TABLE connection_secrets ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connection_secrets_org_id ON connection_secrets(org_id);

ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS org_id TEXT;
UPDATE checkpoints cp SET org_id = c.org_id FROM connections c WHERE cp.connection_id = c.id;
UPDATE checkpoints SET org_id = COALESCE(org_id, 'dev-org');
ALTER TABLE checkpoints ALTER COLUMN org_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkpoints_org_connection_resource_pk'
  ) THEN
    ALTER TABLE checkpoints DROP CONSTRAINT IF EXISTS checkpoints_pkey;
    ALTER TABLE checkpoints ADD CONSTRAINT checkpoints_org_connection_resource_pk PRIMARY KEY (org_id, connection_id, resource);
  END IF;
END $$;

ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS org_id TEXT;
UPDATE webhook_events we SET org_id = c.org_id FROM connections c WHERE we.connection_id = c.id;
UPDATE webhook_events SET org_id = COALESCE(org_id, 'dev-org');
ALTER TABLE webhook_events ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_org_id ON webhook_events(org_id);
