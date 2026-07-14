# MongoDB Atlas — Migration Complete Summary

Brief factual status of the Nelna FG persistence cutover from PostgreSQL to MongoDB Atlas.

## Target

| Item | Value |
|------|--------|
| Provider | MongoDB (Prisma `provider = "mongodb"`) |
| Production DB | `fg_online` |
| UAT DB | `fg_online_uat` |
| Hosting | MongoDB Atlas + Prisma Client generated under `apps/api/generated/prisma-client` |

Connection strings live only in untracked `apps/api/.env` (and host secret stores). This document never contains credentials.

## What landed in code

- Prisma schema models mapped to MongoDB collections (`@map`, ObjectId `@db.ObjectId`).
- Seed and validation paths updated for Mongo.
- Production env guard (`validate-production-env.ts`) requires `mongodb://` / `mongodb+srv://` and the expected database name per deploy tier.
- Health / diagnostics expose provider + database name only — never host, user, or password.
- Inspection evidence binaries use GridFS bucket `fgEvidence` (see `MONGODB_GRIDFS_EVIDENCE.md`).

## Operations

- Prefer `prisma db push` for Mongo schema sync (legacy SQL migrations archived under `docs/database/postgresql-migration-archive/`).
- Backups/restores follow Atlas tooling — not `pg_dump` / `pg_restore`.
- CI should use a Mongo service / Atlas test DB, not PostgreSQL 16.

## Related docs

- `POSTGRESQL_TO_MONGODB_MAPPING.md` — collection / field mapping
- `MONGODB_MIGRATION_AUDIT.md` / `MONGODB_MIGRATION_PLAN.md` — history and planning
- `docs/deployment/MONGODB_ATLAS_SETUP.md` — cluster setup
- `MONGODB_GRIDFS_EVIDENCE.md` — photo evidence storage
