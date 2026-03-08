# Deployment

Kubernetes manifests are under `deploy/k8s` for API, worker, scheduler, and webhook-gateway.

## Required env vars
- `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`
- `API_KEY`, `WEBHOOK_SIGNATURE_SECRET`
- `LOADER_TYPE`, `CLARICORE_INGESTION_BASE_URL`, `CLARICORE_INGESTION_TOKEN`
- `OTEL_EXPORTER_OTLP_ENDPOINT` (optional but recommended)

## Health endpoints
- API: `/health` on `PORT`
- Worker: `/health` on `WORKER_HEALTH_PORT`
- Scheduler: `/health` on `SCHEDULER_HEALTH_PORT`
- Webhook gateway: `/health` on `WEBHOOK_PORT`
