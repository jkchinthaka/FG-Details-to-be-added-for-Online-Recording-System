# Nelna FG Digital Recording System

Professional, mobile-first Progressive Web App for digitising Finished Goods (FG) and Quality Assurance records at **Nelna Farm**.

Replaces paper checklists with a low-click, exception-based workflow:

**Open assigned task → Mark All Acceptable → Modify only failed items → Submit**

## Developer

**Chinthaka Jayaweera**

Repository: [FG-Details-to-be-added-for-Online-Recording-System](https://github.com/jkchinthaka/FG-Details-to-be-added-for-Online-Recording-System.git)

## Phase 1 status

Foundation monorepo with:

- Next.js web app (Today’s Tasks, Daily Cleaning Verification, Freezer Truck Inspection, About, PWA manifest)
- NestJS API (health endpoint, OpenAPI/Swagger, Prisma schema)
- Shared domain types and Zod validation for NMS/PPU/CL/24 and NMS/PPU/CL/30
- Nelna UI components (Mark All Acceptable, checklist toggles, sticky submit)
- Local draft autosave in the browser
- Docker Compose PostgreSQL service

Authentication, persisted task assignment and server-side record submit land in later phases.

## Monorepo layout

```
apps/
  web/     Next.js + TypeScript + Tailwind (mobile-first PWA UI)
  api/     NestJS + Prisma + PostgreSQL REST API
packages/
  shared/  Domain types, Zod schemas, brand constants
  ui/      Nelna design tokens and inspection components
  config/  Shared TypeScript bases
docs/      Architecture and operations documentation
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (optional, for PostgreSQL)

## Quick start

```bash
pnpm install
pnpm --filter @nelna/shared build
pnpm --filter @nelna/ui build

# Terminal A — web
pnpm dev:web

# Terminal B — API
cp apps/api/.env.example apps/api/.env
pnpm --filter @nelna/api prisma:generate
pnpm dev:api

# Optional database
docker compose up -d
```

- Web: http://localhost:3000
- API health: http://localhost:3001/health
- Swagger: http://localhost:3001/api/docs

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev:web` | Start Next.js on port 3000 |
| `pnpm dev:api` | Start NestJS on port 3001 |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm test` | Unit tests |
| `pnpm build` | Production build |

## Brand colours

| Token | Hex |
| --- | --- |
| Primary Green | `#27743A` |
| Light Green | `#46AF53` |
| Dark Green | `#0D3013` |
| Gold | `#D8C76B` |
| Cream | `#EBE9DA` |
| Dark Background | `#251B25` |

## Reference records

1. **Daily Cleaning Verification** — `NMS/PPU/CL/24`
   FG: Wall, Floor, Drainage Line, Foot Bath, Weighing Machine 1 & 2, Cold Room 1 & 2
   Changing Room: Wall, Floor, Locker

2. **Inspection of Freezer Truck Before Loading** — `NMS/PPU/CL/30`
   Truck identity, cleanliness and physical checks, corrective action, loading decision

## Documentation

See [`docs/`](./docs/) for architecture, roles, development setup and security notes.

## License

Proprietary — Nelna Farm / Chinthaka Jayaweera. All rights reserved.
