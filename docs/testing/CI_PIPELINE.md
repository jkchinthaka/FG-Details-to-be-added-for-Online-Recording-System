# CI pipeline — Prompt 36

**Workflow:** `.github/workflows/ci.yml`  
**Triggers:** push/PR to `develop` and `main`

## Jobs

1. **quality** — install (frozen lockfile), shared/ui build, Prisma generate, `format:check`, lint, typecheck, unit tests, production build, `prisma validate` (no production secrets).
2. **postgres-integration** — Postgres 16 service on port 5433, migrate + seed with disposable test accounts, Jest `db-integration` / `db-constraints`.
3. **e2e** — migrate/seed/build, start API+web, Playwright Chromium with `RUN_E2E=1`.

## Secrets policy

- Workflow uses **hard-coded disposable** `TestOnly!…` passwords for CI-only users.
- No production JWT secrets, no plant credentials, no deploy keys in this file.

## Local parity commands

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:test:up
# then test:integration / test:e2e with env from apps/api/.env.test.example
```
