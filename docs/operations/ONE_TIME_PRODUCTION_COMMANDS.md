# One-time Production Commands

Separate **normal application start** from **one-time** schema, seed, bootstrap, and cutover work.

## Normal application start (every deploy / restart)

From `render.yaml`:

```text
buildCommand:
  pnpm install --frozen-lockfile --prod=false &&
  pnpm --filter @nelna/shared build &&
  pnpm --filter @nelna/api prisma:generate &&
  pnpm --filter @nelna/api build

startCommand:
  pnpm --filter @nelna/api start:prod

healthCheckPath:
  /health/ready
```

Do **not** put seed, `prisma db push`, bootstrap, or cutover in Start Command.
Production index maintenance uses `db:indexes:sync` (controlled MongoDB scripts only).

## One-time sequence (operator-run, explicit)

Prerequisites:

- Atlas connectivity restored (`db:diagnose` PASS)
- `DATABASE_URL` targets exactly `fg_online`
- Bootstrap env vars set on the execution shell (never committed):
  - `BOOTSTRAP_ADMIN_USERNAME`
  - `BOOTSTRAP_ADMIN_PASSWORD`
  - `BOOTSTRAP_ADMIN_EMPLOYEE_CODE`
  - `BOOTSTRAP_ADMIN_FULL_NAME`
  - `BOOTSTRAP_ADMIN_EMAIL` (optional)

### 1. Diagnose

```bash
pnpm --filter @nelna/api db:diagnose
```

### 2. Schema / index sync (explicit; not on restart)

**Production / shared environments:** use controlled MongoDB index scripts only.
Do **not** run `prisma db push` against production — Prisma cannot express the
required partial unique indexes and will conflict with
`checklist_templates_currentVersionId_key` (`IndexKeySpecsConflict`) and can
replace a correct partial index with an incompatible normal unique index.

```bash
pnpm --filter @nelna/api db:indexes:sync
```

This runs **only**:

1. `scripts/database/ensure-sparse-current-version-index.js` — idempotent partial unique on `currentVersionId` (leaves a correct index unchanged)
2. `scripts/database/ensure-username-index.js` — idempotent partial unique on `username`; safely replaces Prisma `users_username_key` only after duplicate checks

Requires `DATABASE_URL` targeting exactly `fg_online`. Never logs credentials.

**Local / development only** (new empty DB or intentional schema drift):

```bash
pnpm --filter @nelna/api prisma:push
```

`prisma:push` runs `prisma db push` then re-applies the currentVersionId partial index. It is **not** used by Render Start Command and is **not** part of `db:indexes:sync`.

### 3. Production reference-data seed

```bash
pnpm --filter @nelna/api prisma:seed:production
```

Creates roles/permissions/master reference data. Does not invent production operators.

### 4. Username admin bootstrap

```bash
pnpm --filter @nelna/api bootstrap:admin
pnpm --filter @nelna/api bootstrap:verify
```

### 5. Username cutover (default dry-run)

```bash
pnpm --filter @nelna/api users:cutover:dry-run
# review reports/user-cutover-dry-run-*.json
pnpm --filter @nelna/api users:cutover:execute
```

Cutover **creates/updates the replacement administrator first** and **never archives** that administrator.

Deprecated wrappers (`users:migrate:*`, `archive-legacy-users.ts`) now call the same safe cutover.

### 6. Start API normally

Redeploy or restart so Start Command remains `start:prod` only.

## Rollback procedure

1. Do **not** hard-delete users or historical records.
2. If cutover execute mis-configured admin credentials: re-run `bootstrap:admin` with correct username env (idempotent upsert by employee code).
3. Restore from approved MongoDB backup only into an isolated restore database — never overwrite `fg_online` without a signed GO decision.
4. Keep Render Start Command free of migration commands so a bad one-time script cannot loop on restart.

## Confirmation rule

Any `--execute` path requires:

1. Dry-run report reviewed
2. Database name `fg_online` validated
3. Explicit human confirmation recorded in the operations ticket
