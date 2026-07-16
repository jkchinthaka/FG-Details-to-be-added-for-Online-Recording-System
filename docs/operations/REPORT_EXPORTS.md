# Report export performance (FG-PERF-001)

## Sync vs background

| Path | Limit | Notes |
| --- | --- | --- |
| `GET /reports/run/:kind` | pageSize ≤ 100 | DB skip/take for list reports |
| `GET /reports/run/:kind/csv` | ≤ 500 rows | Returns 413 `REPORT_TOO_LARGE_FOR_SYNC` above cap |
| `POST /reports/exports` | ≤ 5,000 rows | Idempotent job + progress + expiring download token |
| `GET /reports/record-pdf/:id` | single record, ≤ 8 MiB | Bounded PDF |

Worker proxy timeout for non-upload requests is ~30s — large CSV must not stream through a sync browser `window.open` for full history windows.

## Job lifecycle

`QUEUED → RUNNING → COMPLETED|FAILED|CANCELLED → EXPIRED`

Download tokens expire with the job TTL (24h). Cancellation is supported while queued/running.
