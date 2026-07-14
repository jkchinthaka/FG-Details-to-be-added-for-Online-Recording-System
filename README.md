# Nelna FG Digital Recording System

**Developed by:** Chinthaka Jayaweera  
**Repository:** https://github.com/jkchinthaka/FG-Details-to-be-added-for-Online-Recording-System.git

## Project overview

Nelna FG Digital Recording System is a mobile-first Progressive Web App for digitising Finished Goods (FG) and Quality Assurance records at Nelna Farm. It replaces paper checklists with a low-click, exception-based digital workflow.

## Business problem

Daily cleaning verification and freezer truck inspections are still captured on paper. That slows operators, weakens traceability, and makes QA review harder. The system targets a normal daily pass record in roughly **3–5 actions** on a phone.

**Target workflow:** Open assigned task → Mark All Acceptable → Modify only failed items → Submit

## Core capabilities (MVP baseline)

- Authentication and role-based API access  
- Today’s Tasks operator dashboard  
- Daily Cleaning Verification (`NMS/PPU/CL/24`)  
- Freezer Truck Inspection Before Loading (`NMS/PPU/CL/30`) with critical loading block  
- Dynamic checklist template engine (versioned)  
- Corrective-action auto-create on configured fails (full CA workspace still roadmap)  
- Audit logging for key decisions  
- PWA manifest + local draft backup (full offline sync still roadmap)  

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
docs/           Product, security, UAT, operations, handover
scripts/db/     Backup / restore helpers
```

## Local setup

Prerequisites: Node.js 20+, pnpm 9+, PostgreSQL (Docker optional).

```bash
pnpm install
pnpm --filter @nelna/shared build
pnpm --filter @nelna/ui build

# Web
pnpm dev:web

# API
cp apps/api/.env.example apps/api/.env
pnpm --filter @nelna/api prisma:generate
pnpm --filter @nelna/api exec prisma migrate deploy
pnpm --filter @nelna/api exec prisma db seed   # optional, needs seed env vars
pnpm dev:api
```

- Web: http://localhost:3000  
- API health: http://localhost:3001/health  
- Liveness / readiness: `/health/live`, `/health/ready`  
- Swagger: http://localhost:3001/api/docs  

## Environment configuration

Copy example files only. Never commit real secrets.

| File | Purpose |
| --- | --- |
| `.env.example` | Root reference variables |
| `apps/api/.env.example` | API / database / auth |
| `apps/web/.env.example` | Public API URL |

Production API refuses to start without critical configuration (`JWT_*`, `DATABASE_URL`, `COOKIE_SECURE=true`, `API_CORS_ORIGIN`).

## Development commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start web and API in parallel |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm test` | Unit / integration tests |
| `pnpm build` | Production build |
| `pnpm format` | Format with Prettier |

## Git workflow

- Develop on `develop`  
- Do not force-push  
- Verify lint, typecheck, tests and build before every commit  
- Push with `git push origin develop`  
- Promote to `main` only after an evidence-based Go-Live Decision  

## Documentation index

### Product & domain

- [Project brief](docs/PROJECT_BRIEF.md)  
- [Architecture](docs/ARCHITECTURE.md)  
- [Database design](docs/DATABASE_DESIGN.md)  
- [Authentication](docs/AUTHENTICATION.md)  
- [Roles](docs/roles.md)  
- [Records](docs/records.md)  
- [Checklist engine](docs/CHECKLIST_ENGINE.md)  
- [Design system](docs/DESIGN_SYSTEM.md)  
- [UX principles](docs/UX_PRINCIPLES.md)  
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)  

### Requirements & traceability

- [Business requirements](docs/requirements/BUSINESS_REQUIREMENTS.md)  
- [Field mapping matrix](docs/requirements/FIELD_MAPPING_MATRIX.md)  
- [Traceability matrix](docs/requirements/TRACEABILITY_MATRIX.md)  
- [Business rules](docs/requirements/BUSINESS_RULES.md)  
- [Open business decisions](docs/requirements/OPEN_BUSINESS_DECISIONS.md)  

### Engineering quality

- [Architecture review](docs/engineering/ARCHITECTURE_REVIEW.md)  
- [Code quality report](docs/engineering/CODE_QUALITY_REPORT.md)  
- [Technical debt register](docs/engineering/TECHNICAL_DEBT_REGISTER.md)  
- [ADR index](docs/engineering/ADR_INDEX.md)  

### Security & performance

- [Security review](docs/security/SECURITY_REVIEW.md)  
- [Threat model](docs/security/THREAT_MODEL.md)  
- [Data protection](docs/security/DATA_PROTECTION.md)  
- [Incident response](docs/security/INCIDENT_RESPONSE.md)  
- [Performance report](docs/performance/PERFORMANCE_REPORT.md)  
- [Failure recovery matrix](docs/performance/FAILURE_RECOVERY_MATRIX.md)  

### Database & recovery

- [Migration runbook](docs/database/MIGRATION_RUNBOOK.md)  
- [Backup & restore runbook](docs/database/BACKUP_RESTORE_RUNBOOK.md)  
- [Data reconciliation](docs/database/DATA_RECONCILIATION.md)  
- [Restore test evidence](docs/database/RESTORE_TEST_EVIDENCE.md)  

### UAT

- [UAT test plan](docs/uat/UAT_TEST_PLAN.md)  
- [UAT test cases](docs/uat/UAT_TEST_CASES.md)  
- [UAT execution results](docs/uat/UAT_EXECUTION_RESULTS.md)  
- [Defect register](docs/uat/DEFECT_REGISTER.md)  
- [UAT sign-off template](docs/uat/UAT_SIGNOFF_TEMPLATE.md)  
- [Release readiness scorecard](docs/uat/RELEASE_READINESS_SCORECARD.md)  

### Operations

- [Deployment runbook](docs/operations/DEPLOYMENT_RUNBOOK.md)  
- [Environment matrix](docs/operations/ENVIRONMENT_MATRIX.md)  
- [Monitoring and alerting](docs/operations/MONITORING_AND_ALERTING.md)  
- [Rollback plan](docs/operations/ROLLBACK_PLAN.md)  
- [Production checklist](docs/operations/PRODUCTION_CHECKLIST.md)  
- [Smoke tests](docs/operations/SMOKE_TESTS.md)  

### Handover

- [Executive overview](docs/handover/EXECUTIVE_OVERVIEW.md)  
- [Technical handover](docs/handover/TECHNICAL_HANDOVER.md)  
- [Demo script](docs/handover/DEMO_SCRIPT.md)  
- [Management review checklist](docs/handover/MANAGEMENT_REVIEW_CHECKLIST.md)  
- [Support and maintenance](docs/handover/SUPPORT_AND_MAINTENANCE.md)  
- [Future roadmap](docs/handover/FUTURE_ROADMAP.md)  
- [Change request template](docs/handover/CHANGE_REQUEST_TEMPLATE.md)  

### Release (after gate)

- [Release gate report](docs/release/RELEASE_GATE_REPORT.md)  
- [Test summary](docs/release/TEST_SUMMARY.md)  
- [Security summary](docs/release/SECURITY_SUMMARY.md)  
- [Known limitations](docs/release/KNOWN_LIMITATIONS.md)  
- [Release notes v1.0.0](docs/release/RELEASE_NOTES_V1.0.0.md)  
- [Go-live decision](docs/release/GO_LIVE_DECISION.md)  

## Developer attribution

Developed by **Chinthaka Jayaweera**.

## Security note

- Do not commit `.env` files containing secrets  
- Do not hard-code production passwords  
- Do not claim production deployment or restore success without evidence  
