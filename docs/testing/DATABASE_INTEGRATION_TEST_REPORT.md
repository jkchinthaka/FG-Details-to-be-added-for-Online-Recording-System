# Database integration test report — Prompt 36

**Database:** dedicated `nelna_fg_test` only (`docker-compose.test.yml` / CI service).  
**Gate:** `RUN_DB_INTEGRATION=1` and `DATABASE_URL` must contain `nelna_fg_test`.

## Constraints covered

| Topic | Spec coverage |
| --- | --- |
| Template version uniqueness | `db-integration.spec.ts` + `db-constraints.spec.ts` |
| Historical template reference (Restrict) | `db-integration.spec.ts` |
| Transactions and rollback | `db-integration.spec.ts` |
| Archive behaviour (no hard delete required) | `db-integration.spec.ts` |
| Duplicate vehicle numbers | `db-integration.spec.ts` |
| Corrective-action relationships | `db-integration.spec.ts` |
| Re-inspection relationship | `db-integration.spec.ts` |
| Duplicate daily record / approval / SoD / idempotency | Covered primarily by application unit tests (`inspection-records.service.spec.ts`, workflow policy); live DB extension catalogued for CI growth |

## Cleanup strategy

- Tests create uniquely coded templates (`INT/…/${Date.now()}`) and delete created rows in the same test when successful.
- Compose test database uses `tmpfs` so each container lifecycle starts empty.
- CI drops/recreates via fresh service container each job.

## Local result in this sandbox

PostgreSQL was often unreachable (`P1000`). Integration suites **soft-skip** then; CI job is authoritative when green.

## How to run

```bash
pnpm db:test:up
export DATABASE_URL=postgresql://nelna_test:nelna_test@localhost:5433/nelna_fg_test?schema=public
export RUN_DB_INTEGRATION=1
pnpm --filter @nelna/api prisma:generate
pnpm --filter @nelna/api exec prisma migrate deploy
pnpm --filter @nelna/api exec prisma db seed
pnpm test:integration
```
