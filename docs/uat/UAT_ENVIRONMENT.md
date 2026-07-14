# UAT environment — Nelna FG Digital Recording System

**Status: PREPARED, NOT EXECUTED**

Prepared: 2026-07-14  
Owner: Chinthaka Jayaweera  

## Why not executed

Authorized UAT hosting (VMs / PaaS), TLS certificates, managed PostgreSQL credentials, object storage buckets, monitoring project access, and IT change-window approval were **not available** in this development session. Per evidence-integrity rules, deployment success is **not** claimed.

## Prepared topology (provider-neutral)

| Component | Specification |
| --- | --- |
| Web | Next.js production build (`apps/web`) behind HTTPS reverse proxy |
| API | NestJS production build (`apps/api`) with `NODE_ENV=production` |
| Database | Dedicated PostgreSQL 16 schema — **not** shared with production |
| File storage | Private bucket or volume for evidence (placeholder until object-storage ADR) |
| HTTPS | Terminate TLS at load balancer / reverse proxy |
| Health | `/health/live`, `/health/ready` |
| Logs | Structured JSON stdout → log aggregator |
| Backup | Nightly logical dump + retain per plant policy |
| Monitoring | Error tracker + uptime checks (tool TBD by IT) |
| Version | Expose git SHA / package version in `/health` or about page |

## Environment variables (names only)

Copy from `apps/api/.env.example` and validate with production validators:

- `DATABASE_URL` (UAT instance)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (UAT-only, ≥32 chars)
- `COOKIE_SECURE=true`
- `CORS_ORIGIN` = UAT web origin
- `NEXT_PUBLIC_API_URL` = UAT API origin
- Seed account env vars from `UAT_ACCOUNTS_TEMPLATE.md` (values outside git)

## Manual deployment checklist (when access exists)

1. Pre-deploy: freeze tip of `develop` / release candidate SHA  
2. Backup UAT DB if it already has data  
3. `prisma migrate deploy`  
4. Seed with UAT-only credentials (never production)  
5. Deploy API then web  
6. Health + smoke + role-access checks  
7. Confirm backup job registration and monitoring heartbeat  

## Credentials still required

- UAT cloud/VM login or PaaS project  
- UAT PostgreSQL admin connection string  
- TLS certificate or ACM-style issuance  
- Object-storage credentials (if used)  
- Monitoring / pager endpoint  
- Named IT approver for cutover window  

## Related docs

- `docs/operations/UAT_DEPLOYMENT_REPORT.md`
- `docs/operations/UAT_SMOKE_RESULTS.md`
- `docs/uat/UAT_ACCOUNTS_TEMPLATE.md`
