# Restore test evidence — update (Prompt 39)

**Status: NOT EXECUTED (dynamic restore)**

**Date:** 2026-07-14  
**Environment available for overwrite-safe restore:** No authorized empty PostgreSQL target with credentials in this session.

## Required vs performed

| Activity | Status |
| --- | --- |
| Capture backup metadata (date, DB version, app version, SHA, counts, size, encryption, operator) | **NOT EXECUTED** — no live backup produced |
| Restore into separate empty instance | **NOT EXECUTED** — do not overwrite source |
| Reconciliation counts | **NOT EXECUTED** |
| Sample record manual verify | **NOT EXECUTED** |
| RPO / RTO measurement | **NOT EXECUTED** |

## Earlier static design review

See original sections below / historical Prompt 21 content in this file history: schema validate and migration ordering remain design PASS; dynamic backup/restore remain unproven (**DEF-011**).

## Exact commands when access exists

```bash
# On source (UAT/test) — never production without change control
pg_dump --format=custom --file=nelna_fg_$(date +%Y%m%d).dump "$SOURCE_DATABASE_URL"
# Record: date, postgres version, git SHA, row counts scripts/db/record-counts.sql
createdb -h <empty-host> nelna_fg_restore_test
pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" nelna_fg_YYYYMMDD.dump
# Compare counts and sample record IDs; document durations and mismatches
```

## Decision implication

Without a successful restore into an empty instance with reconciliation evidence, Prompt 41 **cannot** claim GO on backup recovery.
