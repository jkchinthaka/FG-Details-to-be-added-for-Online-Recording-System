# Phase 0 Stabilization Report

**Date:** 2026-07-16  
**Branch:** `main`  
**Baseline SHA:** `868c4df907b59ff6d56b34ac6249f75121544afb`  
**Backup branch:** `backup/pre-production-stabilization-20260716-1552`  
**Phase 0 decision:** **FAIL**

---

## Why Phase 0 is FAIL

Required live evidence is incomplete:

| Gate | Evidence | Result |
|------|----------|--------|
| Atlas connection works | Direct `/health/ready` → **503** `db:down` | **FAIL** |
| API `/health/ready` success | Same | **FAIL** |
| Proxied `/api/health/ready` success | **403** from Worker | **FAIL** |
| Exactly one verified active username admin | Not runnable until DB up | **NOT VERIFIED** |
| Frontend/backend same build | Alignment script blocked by ready/proxy | **NOT VERIFIED** |
| Username login works in live env | Blocked by DB down | **NOT VERIFIED** |
| First-password-change works live | Blocked by DB down | **NOT VERIFIED** |
| Unsafe migration cannot archive admin | Unit tests prove cutover excludes admin | **PASS (code)** |

Automated local quality gates largely **PASS**. Production infrastructure remains **MANUAL_ACTION_REQUIRED**.

---

## Changed files (Phase 0)

### Diagnostics / ops

- `apps/api/scripts/diagnose-database.ts`
- `apps/api/src/database/diagnose-database-rules.ts` (+ `.spec.ts`)
- `docs/operations/ATLAS_RENDER_CONNECTIVITY_RUNBOOK.md`
- `docs/operations/ONE_TIME_PRODUCTION_COMMANDS.md`
- `docs/release/PRODUCTION_STABILIZATION_BASELINE.md`
- `scripts/release/verify-release-alignment.ts`
- `scripts/database/ensure-username-index.js`

### Username bootstrap (fixed)

- `apps/api/scripts/bootstrap-admin.ts` — now username-based
- `apps/api/src/database/bootstrap-admin-rules.ts` (+ `.spec.ts`)
- `apps/api/scripts/verify-administrator.ts`
- `apps/api/.env.example`

### Safe cutover (replaces unsafe archive)

- `apps/api/scripts/cutover-users-to-username.ts`
- `apps/api/src/database/cutover-users-to-username-rules.ts` (+ `.spec.ts`)
- `apps/api/scripts/archive-legacy-users.ts` → wrapper to cutover
- `apps/api/scripts/migrate-users-to-username.ts` → wrapper to cutover

### Seed / CI / E2E alignment

- `apps/api/prisma/seed.ts`, `seed-data.ts`, `seed-data.spec.ts` — populate `username`
- `apps/e2e/tests/auth-username.spec.ts` (new)
- `apps/e2e/tests/fg-workflows.spec.ts` — username login
- `.github/workflows/ci.yml` — `E2E_OPERATOR_USERNAME`
- `apps/api/package.json`, root `package.json` scripts
- `apps/api/src/health/health.service.ts` — `RENDER_GIT_COMMIT` build ID support

### Index strategy

- **Approach B:** partial unique MongoDB index on non-null string `username` via `ensure-username-index.js`
- Package script: `db:indexes:sync` (not auto-run on restart)

---

## Designs

### Bootstrap

Env: `BOOTSTRAP_ADMIN_USERNAME`, `PASSWORD`, `EMPLOYEE_CODE`, `FULL_NAME`, optional `EMAIL`.  
Validates `fg_online`, bcrypt 12, upserts by employeeCode, assigns `SYSTEM_ADMINISTRATOR`, revokes sessions, verifies `users:manage`. Idempotent.

### Cutover

Default `--dry-run`. Creates/verifies replacement admin **first**, then archives all **other** users (preserve rows/relations, archived username, clear email, random undisclosed hash, INACTIVE). Never hard-deletes. Never archives replacement admin. Writes safe JSON under `reports/`.

### Render start

Unchanged and correct: `start:prod` only; no seed/bootstrap in Start Command.

---

## Test / build results (local)

| Check | Result |
|-------|--------|
| `@nelna/shared` build | PASS |
| `@nelna/ui` build | PASS |
| prisma generate/validate | PASS |
| `@nelna/api` typecheck | PASS |
| `@nelna/api` lint | PASS (after unused-import fixes) |
| `@nelna/api` test | PASS — 265 passed, 10 skipped |
| `@nelna/api` build | PASS |
| `@nelna/web` typecheck/test | PASS — 113 tests |
| OpenNext Cloudflare build | PASS |
| `@nelna/e2e` without `RUN_E2E=1` | SKIPPED (by design) |
| Live login E2E | **NOT EXECUTED** against production (forbidden) / UAT stack not run here |

---

## Live health (this session)

| URL | Status |
|-----|--------|
| Direct `/health/live` | **200** |
| Direct `/health/ready` | **503** `api=up, db=down, storage=down` |
| Proxied `/api/health/live` | **403** |
| Proxied `/api/health/ready` | **403** |

---

## Manual actions required before Phase 0 can PASS

1. Fix Atlas Network Access for Render Singapore egress (see connectivity runbook).
2. Confirm `DATABASE_URL` → `/fg_online`, credentials, TLS.
3. Re-run `db:diagnose` until ping/replica OK.
4. Run one-time: indexes → seed → `bootstrap:admin` → `bootstrap:verify` → cutover dry-run → (optional) execute.
5. Fix Cloudflare Worker `/api` proxy 403.
6. Redeploy frontend + API from **same** commit; run `pnpm release:verify-alignment`.
7. Execute username login + first password change E2E against **UAT/local**, capture evidence.

---

## Residual risks

- Production DB still unreachable from Render.
- Worker proxy returning 403.
- CI still on Node 20 (Phase 1 item); E2E still `continue-on-error: true` (Phase 1).
- `authVersion` / must-change API guard not yet implemented (Phase 1).

---

## Phase 0 decision

**FAIL** — code and runbooks landed; live Atlas readiness, proxied health, verified production admin, release alignment, and executed login E2E evidence are missing.

**Do not proceed to Phase 1 until Phase 0 gates have real PASS evidence.**
