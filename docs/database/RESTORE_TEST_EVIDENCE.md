# Restore test evidence

**Status: BLOCKED_EXTERNAL_RESTORE_TARGET** (live restore)  
**Fixture tests:** see `pnpm dr:test` / `scripts/disaster-recovery/fg-dr-001.test.js`

**Finding:** FG-DR-001 replaced PostgreSQL `pg_dump`/`pg_restore` guidance with MongoDB Atlas + GridFS tooling.

| Step | Result |
| --- | --- |
| Target validator fixture tests | PASS (automated) |
| Same source/target rejection | PASS (automated) |
| Production target rejection | PASS (automated) |
| GridFS missing/orphan fixtures | PASS (automated) |
| Invariant / index / redaction fixtures | PASS (automated) |
| Live isolated mongorestore | **BLOCKED_EXTERNAL_RESTORE_TARGET** |
| Measured RPO / RTO | **NOT_EXECUTED** |

Canonical procedure: `docs/database/ISOLATED_RESTORE_RUNBOOK.md`.

Historical PostgreSQL evidence notes remain in git history only.
