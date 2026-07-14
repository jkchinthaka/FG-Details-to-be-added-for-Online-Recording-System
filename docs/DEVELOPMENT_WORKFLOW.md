# Development workflow

**Binding queue and release rules:** see [`QUEUE_CONTROLLER.md`](./QUEUE_CONTROLLER.md).

## Branching

- Active development branch: `develop`
- Stay on `develop` for all queued phases until Prompt 25 authorizes promotion
- Prompt 16 prepares a **release candidate** on `develop` only — it must **not** merge to `main` or create/push `v1.0.0`
- **Only Prompt 25** may merge `develop` → `main`, push `main`, and create/push annotated `v1.0.0` (no duplicate tags)
- Never force-push to `develop` or `main`
- Do not use `git reset --hard` unless the project owner explicitly requests it
- Development phases push only: `git push origin develop`

## Author configuration (repository-local)

```bash
git config user.name "Chinthaka Jayaweera"
# Preserve the already configured Git email. Do not invent or replace it.
```

## Before editing

```bash
git branch --show-current
git status --short
git remote -v
git log --oneline -5
```

Confirm origin is:

`https://github.com/jkchinthaka/FG-Details-to-be-added-for-Online-Recording-System.git`

## Verification before every commit

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status --short
git diff --stat
```

Inspect staged diffs for secrets, passwords, API keys, connection strings, build artefacts and large binaries.

## Commit and push

```bash
git add <intended files>
git diff --cached --stat
git commit -m "<phase commit message>"
git push origin develop
git status
git log --oneline -3
git rev-parse HEAD
git rev-parse origin/develop
```

Confirm local HEAD matches `origin/develop`.

## Package build order

Shared packages must build before the API:

```bash
pnpm --filter @nelna/shared build
pnpm --filter @nelna/ui build
pnpm --filter @nelna/api prisma:generate
```

## Quality rules

- No placeholder-only production claims
- No TypeScript or lint errors left behind
- No broken routes
- No committed secrets
- Prefer simple, production-oriented code over boilerplate
