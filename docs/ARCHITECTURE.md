# Claricore V6 Architecture

## Tenant model
All first-class records are org-scoped (`org_id`): connections, sync jobs, schedules, connection secrets, checkpoints, webhook events.

## Runtime services
- `apps/api`: tenant-scoped control plane + sync trigger endpoints.
- `apps/worker`: queue consumer, extractor -> transform -> load pipeline.
- `apps/scheduler`: cron-driven enqueue for active schedules.
- `apps/webhook-gateway`: signature-verified webhook ingest + job enqueue.

## Pipeline
1. API/scheduler/webhook enqueue BullMQ jobs.
2. Worker resolves tenant connection and checkpoint.
3. Salesforce extractor pulls Account/Contact incrementally (`LastModifiedDate`).
4. Transformations map records to canonical model.
5. Loader writes to HTTP, JSONL, or Postgres destination.
6. Worker stores checkpoint and terminal job status.

## Observability
OpenTelemetry is initialized per app and exports OTLP traces when configured.
Structured JSON logs include correlation fields (`orgId`, `connectionId`, `jobId`).
