# Render Backend Setup — Nelna FG API

## Service

- **Type:** Web Service (Node)
- **Custom domain:** `fg-api.nelna.lk`
- **Health check:** `/health/ready`
- **Root directory:** repository root (not `apps/api`)

## Runtime

- **Node:** `22.16.0` via Render env `NODE_VERSION` and repo `.node-version` (must stay on **22.16.x**)
- **pnpm:** `9.12.0` from root `packageManager` (Render Blueprint install — do **not** run `corepack enable` on Render’s native Node image; the filesystem is read-only for `/usr/bin/pnpm`)

## Build / start

Prefer the Blueprint `buildCommand` in `render.yaml`. Equivalent locally (with Corepack):

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
pnpm --filter @nelna/shared build
pnpm --filter @nelna/api prisma:generate
pnpm --filter @nelna/api build
```

```bash
pnpm --filter @nelna/api start:prod
```

Blueprint file: `render.yaml` (no secret values). Deploy only after GitHub Actions **CI PASS** (see `docs/ci/BRANCH_PROTECTION.md`).

## Required production env (set in Render Dashboard)

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `NELNA_DEPLOY_TIER` | `production` |
| `DATABASE_URL` | Atlas URI → database **`fg_online`** (secret) |
| `API_CORS_ORIGIN` | `https://fg.nelna.lk` |
| `JWT_ACCESS_SECRET` | strong secret (secret) |
| `JWT_REFRESH_SECRET` | different strong secret (secret) |
| `ACCESS_TOKEN_TTL` | e.g. `15m` |
| `REFRESH_TOKEN_TTL` | e.g. `7d` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_DOMAIN` | `.nelna.lk` |
| `APP_VERSION` | semver label |
| `APP_BUILD_ID` | **Do not hardcode.** Render injects `RENDER_GIT_COMMIT`; build command exports `GIT_COMMIT_SHA` / `APP_BUILD_ID` from it (see `render.yaml`). |

UAT service uses `NELNA_DEPLOY_TIER=uat`, DB **`fg_online_uat`**, and a non-production CORS origin.

Release alignment: `GET /health/release` must return the same `commitSha` as the Cloudflare Worker `GET /release`. See `docs/deployment/RELEASE_ALIGNMENT.md`.

## Networking

- Process binds `0.0.0.0` on `PORT` (Render injects `PORT`).
- Whitelist Render outbound IPs (or `0.0.0.0/0` with strong DB user) in Atlas Network Access.

## Do not

- Put secrets in `render.yaml`
- Expose `DATABASE_URL` to Cloudflare
- Point UAT at `fg_online`
