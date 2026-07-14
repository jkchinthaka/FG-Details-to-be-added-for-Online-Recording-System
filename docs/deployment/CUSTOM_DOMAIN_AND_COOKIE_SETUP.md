# Custom Domain and Cookie Setup

## Domains

| Role | Hostname |
|------|----------|
| Frontend | `https://fg.nelna.lk` |
| API | `https://fg-api.nelna.lk` |

Both are subdomains of `nelna.lk` so a parent cookie domain works.

## Required cookie options (production)

| Option | Value | Why |
|--------|-------|-----|
| HttpOnly | true | Tokens not visible to JS |
| Secure | true (`COOKIE_SECURE=true`) | HTTPS only |
| SameSite | `lax` | CSRF-resistant default; works for top-level navigations |
| Path | `/` | App-wide |
| Domain | `.nelna.lk` (`COOKIE_DOMAIN`) | Shared across fg + fg-api |

## CORS

- Production: exact origin `https://fg.nelna.lk` only  
- Credentials: `true`  
- Localhost origins allowed only when `NODE_ENV !== "production"`

## Frontend behaviour

- Browser `fetch` / XHR: `credentials: "include"`  
- Middleware: forwards Cookie header to API (`verify-session.ts`); optionally uses `API_INTERNAL_URL`

## Automated coverage

- `apps/api/src/auth/lib/cookies.spec.ts` — `.nelna.lk` domain set/clear  
- `apps/api/src/config/validate-production-env.spec.ts` — CORS origin + cookie domain + Mongo DB name  

## Manual verification (after deploy)

1. Login on production UI  
2. Confirm Set-Cookie includes `Domain=.nelna.lk; Secure; HttpOnly; SameSite=Lax`  
3. Refresh and logout  
4. Confirm unauthorized routes redirect  
5. Confirm evil origin is CORS-rejected  

Live cross-domain success is **not** claimed until that checklist is executed.
