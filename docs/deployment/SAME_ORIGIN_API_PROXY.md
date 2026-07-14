# Same-Origin API Proxy

Browser traffic uses **same origin** as the Cloudflare frontend (`https://fg.nelna.lk`) via an App Router catch-all that proxies to the Nest API on Render.

## Why

- Host-only auth cookies (no `Domain=.nelna.lk` required).
- Avoids browser CORS for normal UI → API calls.
- Keeps the Render API URL out of client bundles.

## Route

Source: `apps/web/src/app/api/[...path]/route.ts`

| Browser request | Upstream |
|-----------------|----------|
| `GET /api/health` | `{API_INTERNAL_URL}/health` |
| `POST /api/auth/login` | `{API_INTERNAL_URL}/auth/login` |
| (any Nest path under `/api/...`) | `{API_INTERNAL_URL}/...` |

## Behaviour

- Fixed upstream only: `process.env.API_INTERNAL_URL` (fallback `http://localhost:3001`). Origin is validated (`http:` / `https:`); no open redirects.
- Forwards: method, body, `cookie`, `content-type`, `accept`, `authorization`.
- Forwards upstream `set-cookie` headers.
- Auth paths force `Cache-Control: private, no-store`.
- ~30s abort timeout; 502/504 JSON errors without stack traces.
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS.

## Frontend base URL

Client modules use:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
```

Production Worker var: `NEXT_PUBLIC_API_URL=/api` (see `apps/web/wrangler.jsonc`).

## Server-side session verify

`verify-session.ts` (middleware) still calls the API **directly**:

```ts
process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
```

On Cloudflare, set secret **`API_INTERNAL_URL`** to the Render public API origin (no credentials in the tracked repo).

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
