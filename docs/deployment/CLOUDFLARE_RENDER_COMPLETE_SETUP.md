# Cloudflare + Render — Complete Setup

End-to-end production shape for Nelna FG: **Cloudflare Workers (frontend)** + **Render (Nest API)** + **MongoDB Atlas**.

## Topology

```
Browser  →  https://fg.nelna.lk  (Cloudflare Worker / OpenNext)
              ├─ UI / assets
              └─ /api/*  →  API_INTERNAL_URL  →  Render Nest API
                                                 └─ MongoDB Atlas (fg_online)
                                                    └─ GridFS bucket fgEvidence
```

Optional direct API host (health, ops, disaster CORS fallback): `https://fg-api.nelna.lk` → same Render service.

## Cloudflare Worker

| Item | Guidance |
|------|----------|
| Config | `apps/web/wrangler.jsonc` |
| Browser API base | `NEXT_PUBLIC_API_URL=/api` (tracked var) |
| Upstream secret | `API_INTERNAL_URL=https://<render-api-host>` — **Worker secret**, never commit real URL with secrets |
| Routes | `fg.nelna.lk/*` |
| Do not set | `DATABASE_URL` on the Worker |

Build with OpenNext; deploy with Wrangler. See `CLOUDFLARE_WORKERS_SETUP.md`.

## Render API

| Item | Guidance |
|------|----------|
| App | Nest API (`apps/api`) |
| `DATABASE_URL` | Atlas URI ending in `/fg_online` (secret) |
| `COOKIE_SECURE` | `true` |
| `COOKIE_DOMAIN` | empty for same-origin proxy (preferred) |
| `NELNA_COOKIE_MODE` | `same_origin` (optional explicit) |
| `API_CORS_ORIGIN` | `https://fg.nelna.lk` (or match `FRONTEND_PUBLIC_URL`) |
| JWT / TTL / version | Required by `assertProductionEnv` |

## Auth cookies (preferred)

Same-origin `/api` proxy → **host-only** cookies on `fg.nelna.lk`:

- HttpOnly, Secure, SameSite=Lax, Path=/
- No `Domain` attribute

Cross-subdomain (legacy): `NELNA_COOKIE_MODE=cross_subdomain` + `COOKIE_DOMAIN=.nelna.lk` if the browser still talks to `fg-api.nelna.lk` directly.

## Checklist (first production cut)

1. Atlas DB `fg_online` reachable from Render; secrets set.
2. Render health OK; production env assert passes.
3. Worker secret `API_INTERNAL_URL` points at Render; `NEXT_PUBLIC_API_URL=/api`.
4. Login on `https://fg.nelna.lk` — cookies set without Domain; refresh works.
5. Save inspection evidence — GridFS file + `/evidence/{id}/download` works for authorized users.
6. Confirm evil Origin is CORS-rejected on the API host.

## Related docs

- `SAME_ORIGIN_API_PROXY.md`
- `CUSTOM_DOMAIN_AND_COOKIE_SETUP.md`
- `RENDER_BACKEND_SETUP.md`
- `CLOUDFLARE_WORKERS_SETUP.md`
- `docs/database/MONGODB_ATLAS_COMPLETE_MIGRATION.md`
- `docs/database/MONGODB_GRIDFS_EVIDENCE.md`
