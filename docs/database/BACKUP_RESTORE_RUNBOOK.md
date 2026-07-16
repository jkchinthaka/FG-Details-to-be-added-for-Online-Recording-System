# Backup & Restore Runbook — OBSOLETE (PostgreSQL)

> **OBSOLETE — FG-DR-001**  
> This document described **PostgreSQL** `pg_dump` / WAL recovery.  
> The system now uses **MongoDB Atlas + GridFS**.

**Canonical runbook:** [`MONGODB_BACKUP_RESTORE_RUNBOOK.md`](./MONGODB_BACKUP_RESTORE_RUNBOOK.md)  
**Isolated restore:** [`ISOLATED_RESTORE_RUNBOOK.md`](./ISOLATED_RESTORE_RUNBOOK.md)  
**Classification:** [`DR_DOCUMENT_CLASSIFICATION.md`](./DR_DOCUMENT_CLASSIFICATION.md)

Do not follow `pg_dump` / `pg_restore` / WAL steps below for production recovery.

---

## Historical archive (PostgreSQL — do not execute)

The previous PostgreSQL content is retained only as historical context in git history
and under `docs/database/postgresql-migration-archive/`. Live recovery must use
Atlas backups / `mongodump` / `scripts/disaster-recovery/*`.
