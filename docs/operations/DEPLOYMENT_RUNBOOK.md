# Deployment Runbook — Nelna FG Digital Recording System

**Audience:** IT Manager, DevOps, release engineer  
**Honesty:** This document prepares deployment. **No production deployment was performed** in the Prompt 23 gate unless Nelna later records otherwise.

---

## 1. Recommended architecture

| Layer | Recommendation |
|-------|----------------|
| Web | Next.js (`apps/web`) behind HTTPS reverse proxy / managed Node host / container |
| API | NestJS (`apps/api`) behind HTTPS; private to VPC where possible |
| Database | Managed PostgreSQL 14+ (16 preferred) with automated backups |
| File storage | Encrypted volume or object storage; path via `FILE_STORAGE_PATH` or future object SDK |
| HTTPS | Terminated at load balancer / reverse proxy; `COOKIE_SECURE=true` |
| Domain | Example pattern: `fg.example.nelna` (web), `fg-api.example.nelna` (API) — **confirm with Nelna IT** |

Environments: see `ENVIRONMENT_MATRIX.md`.

---

## 2. Environment variables (critical)

Production API **refuses to start** without (see `apps/api/src/config/validate-production-env.ts`):

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET` (not a `dev-only` placeholder; ≠ refresh secret)
- `JWT_REFRESH_SECRET`
- `API_CORS_ORIGIN` (explicit web origin)
- `COOKIE_SECURE=true`

Also set: `APP_VERSION`, `APP_BUILD_ID` (short SHA), optional `FILE_STORAGE_PATH`, auth TTLs, cookie domain if split hostnames.

Web: `NEXT_PUBLIC_API_URL` (or project-equivalent) pointing at HTTPS API. See `apps/web/.env.example` and `apps/api/.env.example`.

---

## 3. Database migration process

1. Pre-deployment backup (`docs/database/BACKUP_RESTORE_RUNBOOK.md`).  
2. `prisma migrate status` against target.  
3. Optional preview: review pending SQL under `apps/api/prisma/migrations`.  
4. `pnpm --filter @nelna/api exec prisma migrate deploy`  
5. Seed only when intentionally provisioning reference data (`prisma db seed`).  

Never `db push` in production.

---

## 4. Deployment process (standard)

1. **Pre-deployment backup** — DB + file storage snapshot.  
2. **Artifact / image build** — `pnpm install --frozen-lockfile` → `pnpm build`.  
3. **Environment validation** — confirm secrets in host/secret store; dry-run API with `NODE_ENV=production` expects clean start.  
4. **Migration preview** — list pending migrations.  
5. **Database migration** — `migrate deploy`.  
6. **Application deployment** — roll API then web (or blue/green).  
7. **Health verification** — `GET /health/live`, `GET /health/ready`, `GET /health`.  
8. **Smoke tests** — `SMOKE_TESTS.md`.  
9. **Business smoke tests** — login, open Today’s Tasks, open one draft path.  
10. **Monitoring check** — alerts green (`MONITORING_AND_ALERTING.md`).  
11. **Rollback decision** — within RTO window if smoke fails (`ROLLBACK_PLAN.md`).  
12. **Post-deployment report** — version, buildId, migrator, backup ID, smoke results.

---

## 5. Health endpoints (API)

| Path | Purpose | Failure behaviour |
|------|---------|-------------------|
| `GET /health/live` | Liveness | Process up |
| `GET /health/ready` | Readiness | **503** if production DB down or storage path down |
| `GET /health` | Aggregated | `healthy` or `degraded`; includes `version`, `buildId`, checks — **no secrets/hostnames** |

Wire load balancer: liveness → `/health/live`; readiness → `/health/ready`.

---

## 6. Logging

- Application: structured Nest/Next logs to host aggregator (Datadog / CloudWatch / similar — choose with IT).  
- Do not log JWT, passwords, or full evidence binaries.  
- Retain per Nelna security policy (`docs/security/DATA_PROTECTION.md`).

---

## 7. Backup during deploy

Mandatory dump before migrate. Offsite copy per backup runbook. Restore still requires a proven test (DEF-011 open as of Prompt 22).

---

## 8. Explicit non-claim

**Production deployment status at Prompt 23:** not executed. Infrastructure hostnames, DNS, and TLS certificates are to be selected by Nelna IT — no unverified cloud templates were committed.
