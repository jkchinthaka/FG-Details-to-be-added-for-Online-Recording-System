# Architecture

## Overview

Nelna FG Digital Recording System is a pnpm monorepo:

| App / package | Responsibility |
| --- | --- |
| `apps/web` | Mobile-first Next.js PWA for operators and supervisors |
| `apps/api` | NestJS REST API, OpenAPI, Prisma, RBAC (later phases) |
| `packages/shared` | Domain vocabulary, Zod schemas, brand metadata |
| `packages/ui` | Reusable Nelna inspection/verification components |
| `packages/config` | Shared TypeScript configuration |

## Exception-based recording

Happy-path records use one tap **Mark All Acceptable**. Failure-specific fields appear only after **Fail** is selected. Date, time and shift are captured automatically on the client and will be re-validated on the server when submit APIs land.

## Data model (Prisma)

Core entities: `User`, `TaskAssignment`, `FgRecord`, `DailyCleaningVerification`, `FreezerTruckInspection`, `Vehicle`, `AuditLog`.

Migrations must accompany any schema change. Do not silently reshape production models.

## Environments

- Local web: `http://localhost:3000`
- Local API: `http://localhost:3001`
- Local Postgres: Docker Compose service `postgres` (credentials in `.env.example` only)

Secrets never belong in the repository. Use `.env` / `.env.local` files that remain gitignored.
