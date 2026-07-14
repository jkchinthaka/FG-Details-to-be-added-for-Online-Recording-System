# Rollback Plan — Nelna FG Digital Recording System

## 1. Triggers

Roll back when any of the following occur after a release:

- `/health/ready` failing in production beyond grace period  
- Business smoke tests failing (cannot login / cannot open tasks)  
- Data corruption or migration error  
- Critical security regression  

## 2. Application rollback

1. Announce maintenance / incident channel.  
2. Redeploy previous known-good artifact (`APP_BUILD_ID` / image tag).  
3. Confirm `/health/live` and `/health/ready`.  
4. Re-run smoke tests.  
5. Capture logs and timeline for post-incident review.

Prefer immutable artifacts so rollback is a redeploy, not a rebuild from memory.

## 3. Migration rollback guidance

- **Prefer forward-fix** migrations.  
- If migration left DB incompatible with old app: either (a) deploy forward fix, or (b) restore DB from pre-deploy backup (see below).  
- Do **not** run destructive manual DROP without IT Manager approval.  
- Prisma does not provide automatic down migrations in this project — treat restore as the nuclear option.

## 4. Restore decision criteria

Restore from backup when:

- Schema partially applied and cannot be completed safely, **or**  
- Data loss / corruption confirmed, **or**  
- Application rollback alone cannot serve traffic  

Steps: follow `docs/database/BACKUP_RESTORE_RUNBOOK.md`, restore into verified target, reconcile counts (`DATA_RECONCILIATION.md`), then point apps at restored DB.

## 5. Communication

| Audience | Message |
|----------|---------|
| Operators / Supervisors | System temporarily unavailable; use paper contingency if IT directs |
| QA / Food Safety | Record integrity status; whether paper fallback active |
| IT Manager | Decision, ETA, backup ID used |
| Developer | Commit/tag rolled back to |

## 6. Evidence capture

Retain: failing health responses, deployment IDs, backup filename + SHA-256, migration status output, smoke results, incident ticket ID.
