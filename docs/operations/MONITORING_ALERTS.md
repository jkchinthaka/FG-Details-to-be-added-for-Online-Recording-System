# Monitoring alerts & runbooks (FG-MON-001)

## Telemetry sources

- Structured JSON access logs (`event=http_request`) with requestId, route, status, durationMs, buildId
- Process-local RED metrics: `GET /health/metrics` (admin/`audit:read` in production)
- Dependency latency: Mongo ping + storage check timings in metrics snapshot
- Cloudflare Worker observability (wrangler `observability.enabled`)
- External uptime checks should target:
  - Direct API: `/health/live`, `/health/ready`, `/health`
  - Worker proxy: `/api/health/live`, `/api/health/ready`, `/api/health`

Never scrape endpoints that return personal data. Never include cookies/tokens in uptime probes.

## Suggested thresholds

| Signal | Warning | Critical |
| --- | --- | --- |
| Ready probe failures | 1 in 5 min | 3 consecutive |
| p95 HTTP latency (non-export) | > 2s | > 5s |
| 5xx rate | > 1% | > 5% |
| Rate-limit 429 burst | sustained > 2 min | — |
| Stale-state 409 spike | unusual vs baseline | investigate concurrency |
| Report job failures (`report_job_failures`) | > 0 in 15 min | > 5 in 15 min |
| Upload failures | > 2% | > 10% |
| Refresh reuse (`TOKEN_REUSE_DETECTED`) | any | page on-call |
| DB ping latency | > 500ms | > 2s |
| GridFS/storage down | — | page on-call |

## Runbooks

- Database restore: `docs/database/BACKUP_RESTORE_RUNBOOK.md`
- Evidence orphans: `scripts/database/reconcile-evidence-orphans.js`
- Integrity reconcile: `scripts/database/reconcile-integrity.js` (read-only by default)
- DR tooling: `docs/operations/` + `scripts/disaster-recovery/`

## Release labels

Metrics and logs include `buildId` / commit SHA from `GIT_COMMIT_SHA` / `APP_BUILD_ID` / platform SHA env vars.
