# claricore-connectors (V6 foundation)

Multi-tenant connector runtime for pilot deployments.

## Highlights
- Realistic Salesforce OAuth + Account/Contact incremental extraction.
- Org-scoped persistence and API authorization boundaries (`x-org-id`, `x-api-key`).
- Destination loaders: HTTP ingestion, JSONL file, and Postgres.
- OpenTelemetry-ready tracing + metrics.
- DLQ replay and control-plane operational endpoints.
- Kubernetes deployment manifests.

## Quickstart
```bash
pnpm install
pnpm db:migrate
pnpm dev
```

## Commands
```bash
pnpm test
pnpm lint
pnpm build
pnpm --filter @claricore/cli start dlq:replay 100
```

See docs in `docs/` for architecture, operations, connector SDK, and deployment details.
