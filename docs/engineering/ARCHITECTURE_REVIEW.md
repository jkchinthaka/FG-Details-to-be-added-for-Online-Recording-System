# Architecture Review

**Scope:** `develop` at `49dd986f83472a8d121624786ffd0af4be7dbb06`, reviewed 2026-07-14.

## Current architecture

The repository is a pnpm workspace with two deployable applications and two shared libraries:

- `apps/web`: Next.js App Router UI, with client-side authenticated shell and edge middleware that redirects unauthenticated navigation.
- `apps/api`: NestJS REST API, Prisma persistence, cookie-based JWT authentication, DTO validation, service-layer workflow rules, and Swagger.
- `packages/shared`: domain types, Zod schemas, business rules, checklist engine, roles, and operational datetime utilities.
- `packages/ui`: reusable visual primitives used by the web application.

The intended dependency direction is sound: web and API consume shared contracts; neither application should import the other. Prisma-generated code remains API-local.

## Strengths

- Domain rules with cross-client value—checklist validation, loading-decision calculation, record lifecycle predicates, and Colombo date handling—are in `@nelna/shared`.
- Controllers are thin and authorization decorators are applied at endpoint boundaries. Services additionally enforce sensitive truck-decision authorization.
- Checklist versions are separately modelled and records retain the exact version they used.
- Template mutation paths use transactions for reordering, option replacement, publishing, and archiving.
- Middleware, server-side guards, and the client shell form layered route protection; the API remains the enforcement boundary.

## Architectural risks

| Priority | Finding | Evidence | Recommendation |
| --- | --- | --- | --- |
| High | Record submission is a multi-write workflow without one transaction. A failure after status update can leave a submitted record without corrective actions, task update, truck decision, or audit event. | `InspectionRecordsService.submit` performs sequential writes. | Add an integration-tested transaction with an explicit concurrency/idempotency design before expanding workflow use. |
| High | Inspection responses and evidence are persisted per item. Large dynamic templates produce sequential round trips and can partially persist a draft. | `persistResponses` loops and calls `persistOneResponse`; evidence replacement adds further writes. | Batch or transact only after profiling and add failure/concurrency tests first. |
| Medium | API transport code is duplicated across auth, records, templates, dashboard, and vehicles, with slightly different error/no-content/cache behaviour. | `apps/web/src/lib/*/api.ts`. | Introduce a small tested web-only transport primitive only after agreeing its error contract; do not merge current behaviours implicitly. |
| Medium | `InspectionRecordsService` owns drafting, response persistence, submission, decisions, visibility, task linking, corrective actions, and mapping orchestration. | `apps/api/src/inspection-records/inspection-records.service.ts`. | Split around stable workflow seams when another record type requires it; avoid a speculative rewrite now. |
| Medium | Dashboard and recent-record reads intentionally fail open to empty payloads. This prevents a 500 but can appear as “no work” during an outage. | `TasksService.safeQuery`, `RecordsService.safeQuery`. | Return per-widget availability metadata or surface a degraded-state banner before operational rollout. |
| Low | App shell contains navigation, authentication gating, account menu, layout, and local SVGs. | `apps/web/src/components/AppShell.tsx`. | Keep stable for now; extract only if accessibility or feature changes require independent tests. |

## Boundaries and dependency rules

1. `@nelna/shared` must remain platform-neutral: no React, Nest, Prisma, environment, or fetch imports.
2. Persisted Prisma enums and shared unions need an explicit mapping or parity test when either changes.
3. API DTO decorators handle transport shape; shared Zod schemas remain the canonical domain validation for workflows.
4. Database writes that represent one business transition must be atomic, or explicitly documented as safely retryable.
5. Browser-local state must not be the source of record truth; API authorization and validation remain authoritative.

## Refactor decision

No production refactor was applied in this audit. Existing date duplication is presentation-specific rather than an identical operational helper, and the API clients differ in required response/error semantics. Consolidating either without focused tests would change risk rather than reduce it.
