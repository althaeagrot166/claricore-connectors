# Operations

## Control-plane endpoints
- `POST /jobs/:id/retry`
- `POST /connections/:id/pause`
- `POST /connections/:id/resume`
- `POST /connections/:id/checkpoints/reset`
- `POST /schedules/:id/enable`
- `POST /schedules/:id/disable`

All require `x-org-id` and `x-api-key` headers.

## DLQ replay
Use CLI: `pnpm --filter @claricore/cli start dlq:replay 100`

## Expected behavior
- Worker skips paused connections.
- Scheduler ignores disabled schedules.
- Audit logs emitted for connection create, sync trigger, schedule create, webhook acceptance.
