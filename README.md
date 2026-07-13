# Nelna FG Digital Recording System

**Developer:** Chinthaka Jayaweera
**Repository:** https://github.com/jkchinthaka/FG-Details-to-be-added-for-Online-Recording-System.git

## Project overview

Nelna FG Digital Recording System is a professional, mobile-first Progressive Web App for digitising Finished Goods (FG) and Quality Assurance records at Nelna Farm. It replaces paper checklists with a low-click, exception-based digital workflow.

## Business problem

Daily cleaning verification and freezer truck inspections are still captured on paper. That slows operators, weakens traceability, and makes QA review harder. The system must let a normal daily record be completed in roughly **3â€“5 actions** on a phone.

**Target workflow:** Open assigned task â†’ Mark All Acceptable â†’ Modify only failed items â†’ Submit

## Core features (planned)

- Authentication and role-based access
- Todayâ€™s Tasks operator dashboard
- Daily Cleaning Verification (`NMS/PPU/CL/24`)
- Freezer Truck Inspection Before Loading (`NMS/PPU/CL/30`)
- Dynamic checklist template engine
- Corrective actions, verification, reports, audit logs
- Offline-friendly draft autosave and PWA support

## Technology stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js, TypeScript, Tailwind CSS, React Hook Form, Zod |
| Backend | NestJS, TypeScript, REST, OpenAPI/Swagger |
| Database | PostgreSQL, Prisma ORM |
| Packages | Shared domain types, UI design system, shared config |
| Tooling | pnpm workspaces, ESLint, Vitest/Jest |

## Monorepo structure

```
apps/
  web/          Next.js mobile-first PWA
  api/          NestJS REST API + Prisma
packages/
  ui/           Nelna design system components
  shared/       Domain types, Zod schemas, brand constants
  config/       Shared TypeScript bases
docs/           Product and engineering documentation
```

## Local setup

Prerequisites: Node.js 20+, pnpm 9+, Docker (optional for PostgreSQL).

```bash
pnpm install
pnpm --filter @nelna/shared build
pnpm --filter @nelna/ui build

# Web
pnpm dev:web

# API
cp apps/api/.env.example apps/api/.env
pnpm --filter @nelna/api prisma:generate
pnpm dev:api

# Optional database
docker compose up -d
```

- Web: http://localhost:3000
- API health: http://localhost:3001/health
- Swagger: http://localhost:3001/api/docs
- System status (dev): http://localhost:3000/system-status

## Environment configuration

Copy example files only. Never commit real secrets.

| File | Purpose |
| --- | --- |
| `.env.example` | Root reference variables |
| `apps/api/.env.example` | API / database |
| `apps/web/.env.example` | Public API URL |

Local demo database credentials in Docker Compose are for development only.

## Development commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start web and API in parallel |
| `pnpm dev:web` | Next.js on port 3000 |
| `pnpm dev:api` | NestJS on port 3001 |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm test` | Unit tests |
| `pnpm build` | Production build |
| `pnpm format` | Format with Prettier |

## Git workflow

- Develop on `develop`
- Do not force-push
- Verify lint, typecheck, tests and build before every commit
- Push with `git push origin develop`

## Developer attribution

Built by **Chinthaka Jayaweera** for Nelna Farm Finished Goods and QA operations.

## Current project status

**Foundation (Prompt 1):** Monorepo, NestJS health API, Next.js landing/system status, shared packages, documentation and verification scripts.

Subsequent phases add design system, database domain, authentication, checklist engine and operational workflows.

## Security note

- Do not commit `.env` files containing secrets
- Do not hard-code production passwords
- Prefer environment-controlled seed credentials for development users only
- Keep auditability and least-privilege access in mind for every feature

## Screenshots

Screenshots of the operator and QA experience will be added here as workflows land.

_Placeholder â€” no screenshots yet._
