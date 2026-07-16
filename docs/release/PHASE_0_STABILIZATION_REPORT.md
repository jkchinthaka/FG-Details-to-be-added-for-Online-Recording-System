# Phase 0 Stabilization Report

**Date:** 2026-07-16
**Branch:** `main`
**Implementation commit:** `54a66280f283e5d41d501ac523a7be5110d2acef`
**Baseline SHA (pre-Phase-0 work):** `868c4df907b59ff6d56b34ac6249f75121544afb`
**Backup branch:** `backup/pre-production-stabilization-20260716-1552`
**Phase 0 decision:** **FAIL**

**Re-verification session:** 2026-07-16 ~16:24â€“16:59 Asia/Colombo
**Verified HEAD:** `54a66280f283e5d41d501ac523a7be5110d2acef` (matches `origin/main`)

---

## Why Phase 0 is FAIL

Required live evidence is incomplete after re-probe:

| Gate | Evidence | Result |
|------|----------|--------|
| Atlas connection works | Direct `/health/ready` â†’ **503** `db:down`, `storage:down` (~60s) | **FAIL** |
| API `/health/ready` success | Same | **FAIL** |
| Proxied `/api/health/live` success | Prior **403** (`1003`) from missing `API_INTERNAL_URL` → localhost; config fixed in code — **redeploy Worker required** | **FAIL** (pending redeploy evidence) |
| Proxied `/api/health/ready` success | Same | **FAIL** (pending redeploy evidence) |
| Frontend/backend same build (`54a6628â€¦`) | Direct `/health` `buildId` = `ac85e6656ad8` (does **not** match `54a66280f28`) | **FAIL** |
| Exactly one verified active username admin | Blocked â€” production DB unreachable; no authenticated ops access this session | **NOT VERIFIED** |
| Username login + first password change (live/UAT) | Blocked by DB down / proxy 403; production login not executed | **NOT VERIFIED** |
| Protected API blocked before password change | Not verified live (Phase 1 API guard also still pending) | **NOT VERIFIED** |
| Unsafe migration cannot archive admin | Unit tests prove cutover excludes admin; dry-run default | **PASS (code)** |
| Production cutover execute | Not run | **MANUAL_ACTION_REQUIRED** |

Automated local quality gates **PASS**. Production infrastructure remains **MANUAL_ACTION_REQUIRED**.

No success commit was created (Phase 0 not PASS).

---

## Live health (re-verification 2026-07-16)

| URL | HTTP | Body / notes |
|-----|------|----------------|
| `https://fg-details-to-be-added-for-online.onrender.com/health/live` | **200** | `{"status":"ok","service":"nelna-fg-api"}` (~0.55s) |
| `https://fg-details-to-be-added-for-online.onrender.com/health/ready` | **503** | `{"status":"not_ready","checks":{"api":"up","db":"down","storage":"down"}}` (~60.5s) |
| `https://fg-details-to-be-added-for-online.onrender.com/health` | **200** | `status:degraded`, `buildId:ac85e6656ad8`, `environment:production`, `db:down`, `storage:down` |
| `https://fgdetails.chinthakajayaweera1.workers.dev/api/health/live` | **403** | Cloudflare `error code: 1003` |
| `https://fgdetails.chinthakajayaweera1.workers.dev/api/health/ready` | **403** | Cloudflare `error code: 1003` |
| `https://fgdetails.chinthakajayaweera1.workers.dev/api/health` | **403** | Cloudflare `error code: 1003` |

**Release alignment:** Expected shortened SHA prefix `54a66280f28`. Observed API `buildId` `ac85e6656ad8` â†’ **mismatch** (Render service likely not on commit `54a6628`, or `APP_BUILD_ID` / `RENDER_GIT_COMMIT` not aligned to that SHA). Frontend build ID **not readable** via proxied health (403).

---

## Administrator verification

| Check | Result |
|-------|--------|
| Username populated | **NOT VERIFIED** (DB down / no production query this session) |
| status ACTIVE | **NOT VERIFIED** |
| SYSTEM_ADMINISTRATOR | **NOT VERIFIED** |
| users:manage | **NOT VERIFIED** |
| mustChangePassword true (pre-change) | **NOT VERIFIED** |
| `bootstrap:verify` against production | **NOT EXECUTED** |

Local `db:diagnose` via package script exited without a usable `DATABASE_URL` in the process environment for that invocation (Prisma CLI loads `.env`; the diagnose script does not auto-load it). Production readiness still judged by live `/health/ready`.

---

## Login / first password change

| Check | Result |
|-------|--------|
| Username login (live) | **NOT EXECUTED** â€” API not ready; proxy 403 |
| Redirect to `/change-password` | **NOT EXECUTED** |
| Protected API blocked before change | **NOT EXECUTED** live |
| Password change / old fails / new works / logout | **NOT EXECUTED** live |
| E2E suite `auth-username.spec.ts` | Present; requires `RUN_E2E=1` + non-production DB â€” **not run against production** |

---

## User cutover dry-run verification

| Check | Evidence | Result |
|-------|----------|--------|
| Default mode dry-run | `parseCutoverMode([])` â†’ `dry-run` | **PASS (unit)** |
| Replacement admin excluded | `isReplacementAdmin` + `skip-admin` plan action | **PASS (unit)** |
| No hard deletes in design | Script archives in place; no delete paths | **PASS (code review)** |
| Historical IDs preserved | Archive updates same user row | **PASS (code review)** |
| Dry-run performs no changes | Default `--dry-run`; execute requires `--execute` | **PASS (code)** |
| Re-run cutover unit tests this session | 5/5 passed | **PASS** |
| Production cutover `--execute` | Not run | **MANUAL_ACTION_REQUIRED** |

---

## Changed files (Phase 0 implementation â€” already on `54a6628`)

### Diagnostics / ops

- `apps/api/scripts/diagnose-database.ts`
- `apps/api/src/database/diagnose-database-rules.ts` (+ `.spec.ts`)
- `docs/operations/ATLAS_RENDER_CONNECTIVITY_RUNBOOK.md`
- `docs/operations/ONE_TIME_PRODUCTION_COMMANDS.md`
- `docs/release/PRODUCTION_STABILIZATION_BASELINE.md`
- `scripts/release/verify-release-alignment.ts`
- `scripts/database/ensure-username-index.js`

### Username bootstrap

- `apps/api/scripts/bootstrap-admin.ts`
- `apps/api/src/database/bootstrap-admin-rules.ts` (+ `.spec.ts`)
- `apps/api/scripts/verify-administrator.ts`
- `apps/api/.env.example`

### Safe cutover

- `apps/api/scripts/cutover-users-to-username.ts`
- `apps/api/src/database/cutover-users-to-username-rules.ts` (+ `.spec.ts`)
- `apps/api/scripts/archive-legacy-users.ts` â†’ wrapper to cutover
- `apps/api/scripts/migrate-users-to-username.ts` â†’ wrapper to cutover

### Seed / CI / E2E / health

- `apps/api/prisma/seed.ts`, `seed-data.ts`, `seed-data.spec.ts`
- `apps/e2e/tests/auth-username.spec.ts`
- `apps/e2e/tests/fg-workflows.spec.ts`
- `.github/workflows/ci.yml`
- `apps/api/package.json`, root `package.json`
- `apps/api/src/health/health.service.ts`

### Index strategy

- **Approach B:** partial unique MongoDB indexes managed by controlled scripts (not Prisma `db push` in production):
  - `ensure-sparse-current-version-index.js` â€” `checklist_templates_currentVersionId_key` with partial filter on ObjectId `currentVersionId` (idempotent; correct index left unchanged)
  - `ensure-username-index.js` â€” `users_username_unique_partial`; detects/replaces Prisma `users_username_key` only after duplicate refusal gate
- Package script: `db:indexes:sync` runs **only** those two scripts (no `prisma db push`)
- `prisma:push` remains **local/development only** (documented); never in Render Start Command
- Shared rules: `scripts/database/mongo-index-ensure-rules.js` (+ unit tests)

### Cloudflare API proxy (code fix; live evidence pending redeploy)

- Production `wrangler.jsonc` vars: `NEXT_PUBLIC_API_URL=/api`, `API_INTERNAL_URL=https://fg-details-to-be-added-for-online.onrender.com` (no `/api` suffix)
- UAT env: no production URL — **MANUAL_ACTION_REQUIRED** for explicit UAT origin
- OpenNext production builds validate wrangler proxy vars (reject missing / localhost / private / `/api` path)
- See `docs/deployment/SAME_ORIGIN_API_PROXY.md`

---

## Designs (unchanged summary)

### Bootstrap

Env: `BOOTSTRAP_ADMIN_USERNAME`, `PASSWORD`, `EMPLOYEE_CODE`, `FULL_NAME`, optional `EMAIL`.
Validates `fg_online`, bcrypt 12, upserts by employeeCode, assigns `SYSTEM_ADMINISTRATOR`, revokes sessions, verifies `users:manage`. Idempotent.

### Cutover

Default `--dry-run`. Creates/verifies replacement admin **first**, then archives all **other** users (preserve rows/relations, archived username, clear email, random undisclosed hash, INACTIVE). Never hard-deletes. Never archives replacement admin. Writes safe JSON under `reports/`.

### Render start

Unchanged and correct: `start:prod` only; no seed/bootstrap in Start Command.

---

## Local quality gates (re-run 2026-07-16)

| Check | Result |
|-------|--------|
| `@nelna/shared` build | **PASS** |
| `@nelna/ui` build | **PASS** |
| prisma generate/validate | **PASS** |
| `@nelna/api` typecheck | **PASS** |
| `@nelna/api` test | **PASS** â€” 265 passed, 10 skipped |
| `@nelna/api` build | **PASS** |
| `@nelna/web` typecheck | **PASS** |
| `@nelna/web` test | **PASS** â€” 113 passed |
| OpenNext Cloudflare build | **PASS** |
| `pnpm format:check` | **PASS** |
| `git diff --check` | **PASS** |
| Cutover rules unit tests | **PASS** â€” 5/5 |
| Live login E2E (production) | **NOT EXECUTED** (forbidden) |
| Live login E2E (UAT with `RUN_E2E=1`) | **NOT EXECUTED** this session |

Node engine warning: local Node `v24.11.1` vs wanted `>=22.16.0 <23.0.0` (does not fail builds).

---

## Manual actions required before Phase 0 can PASS

1. Fix Atlas Network Access for Render egress (see `docs/operations/ATLAS_RENDER_CONNECTIVITY_RUNBOOK.md`).
2. Confirm Render `DATABASE_URL` â†’ `/fg_online`, credentials, TLS (no invalid-cert bypass).
3. Confirm live `/health/ready` returns **200** with `db:up` (and storage as required).
4. Redeploy Cloudflare Worker with `API_INTERNAL_URL` set in `wrangler.jsonc` (commit after proxy fix); confirm proxied `/api/health/*` returns **200** (prior root cause: fallback to `localhost:3001` blocked by `global_fetch_strictly_public`).
5. Redeploy **frontend and API** from the same authorized commit; set `APP_BUILD_ID` from that SHA; confirm both health payloads match.
6. One-time (with confirmation): indexes â†’ seed â†’ `bootstrap:admin` â†’ `bootstrap:verify`.
7. Cutover: `users:cutover:dry-run` only until reviewed; `--execute` remains **MANUAL_ACTION_REQUIRED**.
8. Capture UAT/local evidence for username login + first password change (never production test credentials against prod without explicit approval and readiness).

---

## Residual risks

- Production DB still unreachable from Render (`db:down`).
- Worker proxy 403 (`1003`) until Worker redeployed with `API_INTERNAL_URL` (code fixed; live not yet verified).
- Deployed API `buildId` not on Phase 0 commit.
- CI still on Node 20; E2E still `continue-on-error: true` (Phase 1).
- `authVersion` / must-change API guard not yet implemented (Phase 1).

---

## Phase 0 decision

**FAIL** â€” implementation commit `54a6628` is on `main` and local quality gates pass; live Atlas readiness, proxied health, build ID alignment, verified production admin, and executed login/password-change evidence are still missing.

**Do not proceed to Phase 1 until Phase 0 gates have real PASS evidence.**
