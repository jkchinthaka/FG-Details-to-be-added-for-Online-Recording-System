# Deployment Readiness Audit — Cloudflare / Render / Atlas

**Audit date:** 2026-07-14  
**Branch:** `feature/cloudflare-render-deployment`  
**Baseline:** `develop` @ `33c3ebc`

## Summary

| Area | Readiness | Notes |
|------|-----------|-------|
| Cloudflare Workers (OpenNext) | **PREPARED** | Adapter, wrangler, scripts, headers added — live Worker deploy **not executed** |
| Render NestJS | **PREPARED** | `0.0.0.0` listen, `PORT`, `render.yaml`, CORS hardening — live Render deploy **not executed** |
| MongoDB Atlas | **BLOCKED** | Prisma still PostgreSQL on this branch; migration on `feature/mongodb-atlas-migration` |
| Cross-subdomain cookies | **PREPARED** | Tests for `.nelna.lk` domain; live cross-origin UAT **not executed** |
| CI | Partial | Still Postgres-oriented until Mongo migration lands |

## Findings

### Frontend (`apps/web`)

| Item | Status |
|------|--------|
| Next.js App Router | Present — keep (no static export) |
| Middleware session verify | Present — calls API with forwarded cookies |
| PWA / SW | Present (`public/sw.js`, manifest) |
| `@opennextjs/cloudflare` | Added |
| `wrangler.jsonc` / `open-next.config.ts` | Added |
| preview / deploy / upload scripts | Added |
| `.open-next` gitignored | Yes |
| `NEXT_PUBLIC_API_URL` prod default in wrangler vars | `https://fg-api.nelna.lk` |
| DATABASE_URL on Worker | Must remain unset |

### Backend (`apps/api`)

| Item | Status |
|------|--------|
| Listen `PORT` + `0.0.0.0` | Updated |
| Exact CORS + credentials | Updated (`cors-origin.ts`) |
| Production env gate | Strengthened for Atlas + cookie domain + fg.nelna.lk |
| `/health/ready` | Present (Render health check) |
| `/health/database-config` | Safe diagnostic (no secrets) |
| Monorepo build | `render.yaml` uses repo-root pnpm filters |

### Database

| Item | Status |
|------|--------|
| Prisma provider | **postgresql** (blocking for Atlas deploy) |
| `fg_online` / seed / db push | Not verified on this branch |
| Atlas IP allowlist for Render | Manual — see `MONGODB_ATLAS_SETUP.md` |

## Verdict

**Configuration preparation: YES**  
**UAT deployment safe: NO** — wait for MongoDB migration merge + Atlas verify + Worker/API live smoke.

**Deployed end-to-end success claimed: NO**
