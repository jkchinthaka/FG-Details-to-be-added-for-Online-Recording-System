# Same-Origin API Proxy

Browser traffic uses **same origin** as the Cloudflare frontend (`https://fgdetails.chinthakajayaweera1.workers.dev` / future `https://fg.nelna.lk`) via an App Router catch-all that proxies to the Nest API on Render.

## Why

- Host-only auth cookies (no `Domain=.nelna.lk` required).
- Avoids browser CORS for normal UI → API calls.
- Keeps the Render API URL out of client bundles (clients only see `/api`).

## Route

Source: `apps/web/src/app/api/[...path]/route.ts`

| Browser request | Upstream |
|-----------------|----------|
| `GET /api/health` | `{API_INTERNAL_URL}/health` |
| `POST /api/auth/login` | `{API_INTERNAL_URL}/auth/login` |
| (any Nest path under `/api/...`) | `{API_INTERNAL_URL}/...` |

**Do not** set `API_INTERNAL_URL` with a trailing `/api` — that produces `/api/api/...`.

## Behaviour

- Upstream from `process.env.API_INTERNAL_URL` (production: required HTTPS public origin).
- Development fallback: `http://localhost:3001` only when not production.
- Production never falls back to localhost (Cloudflare `global_fetch_strictly_public` blocks private hosts → 403).
- Origin validated; no open redirects.
- Forwards: method, body, `cookie`, `content-type`, `accept`, `authorization`.
- Forwards upstream `set-cookie` headers.
- Auth paths force `Cache-Control: private, no-store`.
- ~30s abort timeout; 502/504 JSON errors without stack traces.
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS.

## Production Wrangler vars (`apps/web/wrangler.jsonc`)

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `/api` |
| `API_INTERNAL_URL` | `https://fg-details-to-be-added-for-online.onrender.com` (origin only) |

No credentials, tokens, or `DATABASE_URL` in `wrangler.jsonc`.

OpenNext/`next build` with `NODE_ENV=production` validates these vars and **fails the build** if `API_INTERNAL_URL` is missing, localhost, private, or includes `/api`.

## UAT

Wrangler env `uat` intentionally **omits** `API_INTERNAL_URL`.

**MANUAL_ACTION_REQUIRED:** before `wrangler deploy --env uat`, set an explicit UAT Render origin (not production). Validation rejects UAT configs that copy the production Render URL.

## Server-side session verify

`verify-session.ts` (middleware) calls the Nest API **directly** using the same production `API_INTERNAL_URL` rules (never uses `/api` as upstream).

## Local development

Option A — with proxy (matches production):

1. API on `:3001`
2. Next on `:3000` with `API_INTERNAL_URL=http://localhost:3001` and `NEXT_PUBLIC_API_URL=/api`

Option B — direct (legacy): set `NEXT_PUBLIC_API_URL=http://localhost:3001` and skip relying on `/api`.

## Cookies

For same-origin proxy production:

- `COOKIE_SECURE=true`
- Leave `COOKIE_DOMAIN` empty (or `NELNA_COOKIE_MODE=same_origin`)
- Cross-subdomain mode remains available: `NELNA_COOKIE_MODE=cross_subdomain` + `COOKIE_DOMAIN=.nelna.lk`

## Deploy frontend (after this config)

```bash
pnpm --filter @nelna/shared build
pnpm --filter @nelna/ui build
pnpm --filter @nelna/web exec opennextjs-cloudflare build
pnpm --filter @nelna/web exec wrangler deploy
```

Then verify:

```bash
curl.exe -i https://fgdetails.chinthakajayaweera1.workers.dev/api/health/live
curl.exe -i https://fgdetails.chinthakajayaweera1.workers.dev/api/health/ready
```
