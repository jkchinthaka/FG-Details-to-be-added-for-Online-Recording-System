# Production Stabilization Baseline

**Date:** 2026-07-16  
**Branch:** `main`  
**HEAD SHA:** `868c4df907b59ff6d56b34ac6249f75121544afb`  
**Backup branch (not checked out):** `backup/pre-production-stabilization-20260716-1552`  
**Release decision at baseline:** **NO-GO / NOT PRODUCTION_READY** (evidence-based)

---

## Current architecture

| Layer | Technology | Deployed URL |
|-------|------------|--------------|
| Frontend | Next.js 15 + OpenNext Cloudflare Worker (`fgdetails`) | https://fgdetails.chinthakajayaweera1.workers.dev |
| API proxy | Same-origin `/api` → Render | via Worker |
| Backend | NestJS 11 on Render (`nelna-fg-api`) | https://fg-details-to-be-added-for-online.onrender.com |
| Database | MongoDB Atlas | production DB name must be `fg_online` |
| Evidence | GridFS bucket `fgEvidence` | Atlas |
| Auth | Username + password, JWT access + rotating refresh cookies | httpOnly |

---

## Current implementation state (code)

| Capability | State | Notes |
|------------|-------|-------|
| Username login (API + web) | Implemented | Shared `loginSchema` uses `username` |
| First-login password change | Implemented | `POST /auth/change-password`, `/change-password` page |
| Admin user CRUD | Implemented | `/admin/users` + Nest controllers |
| Role assign / activate / deactivate / reset | Implemented | Last-admin protection exists |
| Refresh-token rotation | Implemented | |
| API middleware bypass | Implemented | `/api` excluded from page auth redirects |
| Render start without seed | Correct | `startCommand` = `start:prod` only |
| Health build metadata | Partial | `/health` exposes truncated build ID |
| Username bootstrap | **Broken for login** | Still `BOOTSTRAP_ADMIN_EMAIL`; does not set `username` |
| Legacy archive script | **Unsafe** | Archives **all** users; does not exclude replacement admin |
| `authVersion` | Absent | Phase 1 item |
| Must-change-password API guard | Absent | Frontend redirect only |
| CI Node version | **Mismatch** | CI uses Node 20; Render pins 22.16.0 |
| E2E credentials | **Stale** | Still email-oriented; `continue-on-error: true` |

Recent username-related commits:

- `868c4df` — feat: add database-backed username user management
- `09b42b1` — feat: add username-based user management
- `20ad53b` — feat: add secure administrator bootstrap command (email-based)

---

## Live probe evidence (2026-07-16, from this session)

| Probe | HTTP | Body / observation |
|-------|------|--------------------|
| Direct `/health/live` | **200** | `{"status":"ok","service":"nelna-fg-api"}` |
| Direct `/health/ready` | **503** | `{"status":"not_ready","checks":{"api":"up","db":"down","storage":"down"}}` (~60s) |
| Proxied `/api/health/live` | **403** | Worker/proxy blocked or misconfigured |
| Proxied `/api/health/ready` | **403** | Same |

**Interpretation:** Nest process starts, but MongoDB Atlas is not reachable from Render (matches reported ReplicaSetNoPrimary / TLS / Network Access failures). Cloudflare Worker is not successfully proxying health (403). Frontend/backend release alignment cannot be proven until readiness is green.

---

## Known Critical / High risks

1. **CRITICAL — Atlas connectivity:** `/health/ready` reports `db:down`. No production login or bootstrap can succeed until Network Access / credentials / URI are fixed (manual Atlas + Render).
2. **CRITICAL — Unsafe archive script:** `archive-legacy-users.ts` can deactivate every user including the only administrator.
3. **CRITICAL — Email-only bootstrap:** `bootstrap:admin` does not set `username`; username login cannot use that account.
4. **HIGH — Proxied API 403:** Frontend `/api` path does not reach Nest health endpoints from the public Worker URL.
5. **HIGH — CI soft-fail E2E + email vars:** Release gate can pass with broken username auth tests.
6. **MEDIUM — Null username unique index:** Multiple users with `username: null` can break unique index creation until cutover populates usernames or a sparse unique index is applied.

---

## Manual infrastructure blockers (MANUAL_ACTION_REQUIRED)

These cannot be completed from repository code alone without authenticated Atlas / Render / Cloudflare access:

| Blocker | Owner surface | Required action |
|---------|---------------|-----------------|
| Atlas cluster AVAILABLE + primary elected | MongoDB Atlas | Confirm cluster health |
| Network Access includes Render Singapore egress | Atlas | Add Render outbound CIDRs (not permanent `0.0.0.0/0`) |
| Database user password + `readWrite` on `fg_online` | Atlas | Verify user |
| `DATABASE_URL` path `/fg_online`, TLS, URI-encoded password | Render | Set secret; never commit |
| Worker `/api` proxy → Render (403 today) | Cloudflare | Verify routes, env, Worker deploy of same SHA |
| `APP_BUILD_ID` / commit SHA on both sides | Render + Cloudflare | Derive from deploy commit |

---

## Files expected to change in Phase 0–2

**Phase 0 (stabilization):**

- `apps/api/scripts/diagnose-database.ts`, `bootstrap-admin.ts`, `cutover-users-to-username.ts`, `verify-administrator.ts`
- `apps/api/src/database/bootstrap-admin-rules.ts`, cutover rules + tests
- `scripts/database/ensure-username-index.js`
- `scripts/release/verify-release-alignment.ts`
- `apps/api/package.json`, root package scripts as needed
- `docs/operations/*`, `docs/release/PHASE_0_*`
- E2E username auth tests under `apps/e2e`
- Wrappers: `archive-legacy-users.ts`, `migrate-users-to-username.ts`

**Phase 1 (security):** `authVersion`, guards, rate limit, request ID, logging, Swagger, CI Node 22.16.0

**Phase 2 (business readiness):** approval packs, restore/perf/a11y/UAT/pilot docs — many default `NOT_EXECUTED` until humans run them

---

## Current release decision

| Gate | Status |
|------|--------|
| Technical code for username login | Present on `main` |
| Live DB connectivity | **FAIL** (`db:down`) |
| Proxied health | **FAIL** (403) |
| Verified username admin in production | **NOT VERIFIED** |
| Frontend/backend same build | **NOT VERIFIED** |
| UAT / restore / pilot / business signatures | Prior docs: unsigned / NO-GO |
| **Baseline decision** | **NO-GO — enter Phase 0 with code + runbooks; infrastructure remains MANUAL_ACTION_REQUIRED** |

No production behaviour was changed before this baseline was written.
