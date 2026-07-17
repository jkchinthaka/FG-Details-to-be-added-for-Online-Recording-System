# Continuous integration (FG-CI-001)

## Runtime pins

| Tool | Version |
| --- | --- |
| Node.js | **22.16.x** (`22.16.0` in CI / `.node-version` / Render) |
| pnpm | **9.12.0** via `packageManager` + Corepack / `pnpm/action-setup` |

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
node -v   # expect v22.16.x for release work
pnpm -v   # expect 9.12.0
```

## Local equivalent of mandatory gates

Use **only** `fg_online_test` (see `docker-compose.test.yml`). Never point
`DATABASE_URL` at production `fg_online`.

```bash
pnpm install --frozen-lockfile
pnpm --filter @nelna/shared build
pnpm --filter @nelna/ui build
pnpm --filter @nelna/api prisma:generate
pnpm --filter @nelna/api prisma:validate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm --filter @nelna/shared exec vitest run src/release-manifest.test.ts
pnpm --filter @nelna/shared exec vitest run src/evidence-upload.test.ts
pnpm test   # shared + ui + api unit + web (DB-gated specs skip without RUN_DB_INTEGRATION)
pnpm --filter @nelna/api build
pnpm --filter @nelna/web exec opennextjs-cloudflare build
node scripts/ci/secret-scan.js
pnpm audit --prod --audit-level=critical

pnpm db:test:up
export DATABASE_URL='mongodb://127.0.0.1:27017/fg_online_test?replicaSet=rs0&directConnection=true'
export RUN_DB_INTEGRATION=1
# seed fg_online_test, then:
pnpm --filter @nelna/api exec jest --runInBand --testPathPattern='db-integration|db-constraints|fg-conc-001|fg-db-001|fg-auth-001'
```

E2E (blocking locally when you opt in):

```bash
export RUN_E2E=1
# start API+web against fg_online_test, then:
pnpm --filter @nelna/e2e test
```

## Branch protection

See [`BRANCH_PROTECTION.md`](./BRANCH_PROTECTION.md) — must be applied in GitHub
settings (external to the repo).

## Safety

- No `continue-on-error` on mandatory jobs
- No production credentials in Actions secrets for test jobs
- Artifacts: JUnit/coverage/Playwright failure traces only
