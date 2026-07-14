# Restore Test Evidence — Nelna FG Digital Recording System

**Document control:** Prompt 21 database integrity phase  
**Date:** 2026-07-14  
**Executor:** Automated agent session (Chinthaka Jayaweera development environment)  
**Branch:** `develop` @ pre-commit HEAD `2b7ad44` (then this commit)

---

## 1. Environment under test

| Item | Value |
|------|--------|
| Host OS | Windows 10 (build 22631) |
| Workspace | Local clone of FG Digital Recording System |
| Target DB (configured) | `postgresql://…@localhost:5432/nelna_fg` (credentials redacted) |
| Docker | **Unavailable** — Docker Desktop engine pipe not found |
| `pg_dump` / live Postgres session | **Not available with valid credentials** |

---

## 2. Static validations performed (PASS)

| Check | Method | Result |
|-------|--------|--------|
| Prisma schema validation | `pnpm --filter @nelna/api exec prisma validate` | **PASS** — schema valid |
| Migration lock | Read `migration_lock.toml` | **PASS** — provider `postgresql` |
| Migration ordering | Lexicographic inventory of 7 SQL migrations | **PASS** — ordered; dual `…40000` timestamps documented |
| Unique constraints / FKs / indexes | Schema + migration SQL review | **PASS** — documented in `MIGRATION_RUNBOOK.md` |
| Template-version integrity | `InspectionRecord.templateVersionId` Restrict | **PASS** (design) |
| Approval / CA / attachment / audit refs | Schema review | **PASS** (design) |
| Archive behaviour | Soft archive policy in schema comments + no verified hard-delete API | **PASS** (design); raw SQL cascade risk documented |
| Uncontrolled cascade | Catalogued Restrict vs Cascade edges | **PASS** with documented residual risk on hard DELETE of records |
| Seed idempotency | Review of `seed.ts` upsert patterns | **PASS** (code review); dual-run on live DB **not executed** |

---

## 3. Dynamic validations (NOT EXECUTED)

| Check | Attempt | Outcome |
|-------|---------|---------|
| `prisma migrate status` | Against localhost:5432 | **FAIL / blocked** — `P1000` authentication failed for user `nelna` |
| New environment migrate from zero | Requires empty reachable DB | **NOT EXECUTED** |
| Seed dual-run | Requires DB | **NOT EXECUTED** |
| Scenario fixture load (pass/fail/truck/CA/v1–v2) | Requires DB | **NOT EXECUTED** |
| `pg_dump` backup | Requires DB | **NOT EXECUTED** |
| `pg_restore` into disposable DB | Requires dump + DB | **NOT EXECUTED** |
| Post-restore count reconciliation | Requires restore | **NOT EXECUTED** |
| Dump SHA-256 verification cycle | Requires dump | **NOT EXECUTED** |

---

## 4. Reconciliation evidence

| Metric | Before backup | After restore | Match? |
|--------|---------------|---------------|--------|
| User count | — | — | **N/A — restore not performed** |
| Template count | — | — | **N/A** |
| Record count | — | — | **N/A** |
| Result count | — | — | **N/A** |
| Approval count | — | — | **N/A** |
| Corrective action count | — | — | **N/A** |
| Audit log count | — | — | **N/A** |
| Critical sample values | — | — | **N/A** |
| Dump checksum | — | — | **N/A** |

---

## 5. Formal restore-test verdict

### **RESTORE TEST: NOT PERFORMED**

A real backup and restore was **not** completed in this environment. Therefore this phase **does not** claim that recovery works end-to-end.

### What *is* claimed

- Schema and migration set are validated statically.  
- Runbooks and scripts exist to perform backup/restore/reconciliation when a working PostgreSQL is available.  
- Cascade / archive / version-integrity design was reviewed against Prisma schema and SQL.

### Required follow-up (before production reliance on recovery)

1. Provision reachable Postgres (or start Docker Compose if adopted).  
2. Run `migrate deploy` on empty DB; capture timing.  
3. Seed twice; confirm counts stable.  
4. Load scenario fixtures from `MIGRATION_RUNBOOK.md` §8.  
5. Run `scripts/db/backup.ps1` (or `.sh`).  
6. Restore into a second database.  
7. Fill this evidence table with matching counts and checksums.  
8. Update this document with **RESTORE TEST: PASS** only after step 7 succeeds.

---

## 6. Sign-off placeholder

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | Chinthaka Jayaweera | 2026-07-14 | Static validation only |
| IT Manager | _pending_ | | |
| QA / Food Safety | _pending_ | | |

---

*Honesty rule: never mark restore as passed without execution evidence above.*
