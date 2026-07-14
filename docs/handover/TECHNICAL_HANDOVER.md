# Technical Handover — Nelna FG Digital Recording System

**Maintainer on delivery:** Chinthaka Jayaweera  
**Primary branch:** `develop` (promote to `main` only via release gate)

---

## Architecture

Monorepo (pnpm): Next.js PWA (`apps/web`) + NestJS API (`apps/api`) + shared packages (`packages/shared`, `packages/ui`, `packages/config`). PostgreSQL via Prisma. Details: `docs/ARCHITECTURE.md`, `docs/engineering/ARCHITECTURE_REVIEW.md`, ADRs in `docs/engineering/adr/`.

## Repository structure

```
apps/web          Next.js UI
apps/api          NestJS + Prisma schema/migrations/seed
packages/shared   Domain types, permissions, Zod, brand
packages/ui       Design system
packages/config   TS bases
docs/             Product, security, UAT, ops, handover
scripts/db        Backup/restore helpers
```

## Technology stack

Node 20+, pnpm 9, Next.js, NestJS, Prisma, PostgreSQL, Tailwind, Jest (API), Vitest (web/shared/ui).

## Environment setup

1. `pnpm install`  
2. Build shared/ui  
3. Copy `.env.example` files — never commit secrets  
4. `prisma generate` → `migrate deploy` → optional `db seed`  
5. `pnpm dev`  

See root `README.md`.

## Database

Schema: `apps/api/prisma/schema.prisma`. Migrations: ordered under `prisma/migrations/`. Runbooks: `docs/database/`. Archive preferred over hard delete for quality records.

## Authentication

Cookie JWT access + hashed refresh; lockout; inactive refusal. Config: `apps/api/src/auth/`. Docs: `docs/AUTHENTICATION.md`.

## Role model

Roles + permissions in shared package and seed. API enforces via guards. Web nav filters by role; middleware is cookie-presence only (DEF-010).

## APIs

REST under NestJS. Swagger at `/api/docs` (non-sensitive environments). Health: `/health`, `/health/live`, `/health/ready`. Inspection records, vehicles search, checklist templates, auth, tasks/dashboard endpoints — see controllers under `apps/api/src`.

## File storage

Attachment metadata in DB; binary strategy ADR-007. Optional `FILE_STORAGE_PATH` readiness check.

## PWA

Web manifest present; localStorage draft backup. Service-worker sync deferred (ADR-006).

## Offline drafts

`apps/web/src/lib/draft-storage.ts` — local backup only; server remains source of truth when online.

## Testing

`pnpm test` — unit/integration. No Playwright e2e pack yet. UAT catalogue in `docs/uat/`.

## Deployment

`docs/operations/DEPLOYMENT_RUNBOOK.md`. Production env validation fails closed (`validate-production-env.ts`).

## Monitoring

`docs/operations/MONITORING_AND_ALERTING.md`.

## Backup

`docs/database/BACKUP_RESTORE_RUNBOOK.md` + `scripts/db/*`.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| API won’t start in production | Missing JWT / `COOKIE_SECURE` / `DATABASE_URL` / CORS |
| Ready 503 | DB down or storage path unwritable |
| Login lockout | Wait configured minutes or clear `lockedUntil` with DBA care |
| Draft conflict | Resume existing draft for same day/shift/area |
| Critical loading cannot approve | Intended — clear critical fails / re-inspect |

## Git workflow

Feature work on `develop`. Verify lint, typecheck, test, build. Push `origin/develop`. No force-push. Release: tag from agreed Go-Live Decision.

## Release process

UAT → ops checklist → release gate docs → (if decision permits) merge `develop` → `main`, tag `vX.Y.Z`.
