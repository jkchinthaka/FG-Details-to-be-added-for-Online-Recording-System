# Development

## Branch

Use `develop` for all feature work. Do not force-push.

## Install

```bash
pnpm install
```

## Build order

Shared packages must build before the API:

```bash
pnpm --filter @nelna/shared build
pnpm --filter @nelna/ui build
pnpm --filter @nelna/api prisma:generate
pnpm build
```

## Database

```bash
docker compose up -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @nelna/api exec prisma migrate dev --name init
```

## Verification checklist

Before committing:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

## Security

- Never commit `.env` files with secrets
- Never hard-code passwords
- Prefer example env files with local-only demo credentials clearly marked as non-production
