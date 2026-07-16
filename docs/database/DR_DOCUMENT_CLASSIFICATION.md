# Document classification — Backup & Disaster Recovery (FG-DR-001)

| Document | Classification | Notes |
| --- | --- | --- |
| `docs/database/MONGODB_BACKUP_RESTORE_RUNBOOK.md` | **canonical** | MongoDB Atlas + GridFS backup/restore |
| `docs/database/ISOLATED_RESTORE_RUNBOOK.md` | **canonical** | Isolated restore exercise procedure |
| `docs/operations/DISASTER_RECOVERY_PLAN.md` | **canonical** | DR plan, ownership, escalation |
| `docs/operations/QUARTERLY_RESTORE_EXERCISE.md` | **canonical** | Quarterly drill checklist |
| `docs/database/RECONCILIATION_REPORT_TEMPLATE.md` | **canonical** | Post-restore reconciliation template |
| `docs/database/MONGODB_GRIDFS_EVIDENCE.md` | **canonical** | GridFS evidence storage behaviour |
| `docs/database/BACKUP_RESTORE_RUNBOOK.md` | **obsolete** (PostgreSQL) | Redirect stub only |
| `docs/database/RESTORE_TEST_EVIDENCE.md` | **historical** | Prior NOT_EXECUTED PostgreSQL evidence |
| `docs/database/DATA_RECONCILIATION.md` | **obsolete** (SQL) | Superseded by MongoDB reconciliation tooling |
| `docs/release/FINAL_RESTORE_SUMMARY.md` | **historical** | Still NOT_EXECUTED for live restore |
| `docs/database/postgresql-migration-archive/**` | **historical / PostgreSQL-specific** | Archived migrations |
| `scripts/db/backup.ps1`, `backup.sh`, `restore.ps1` | **obsolete** (PostgreSQL) | Do not use |
| `scripts/disaster-recovery/**` | **canonical / MongoDB+GridFS** | FG-DR-001 tooling |
| `scripts/database/backup-fg-online.js` | **MongoDB-specific** (ops) | Logical JSON backup; refuse non-`fg_online` |
| `scripts/database/reconcile-evidence-orphans.js` | **MongoDB/GridFS-specific** | Orphan binary maintenance |

PostgreSQL WAL / `pg_dump` guidance is **not** applicable to the current Atlas deployment.
