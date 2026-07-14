# Deployment result — Nelna FG Digital Recording System

**Date:** 2026-07-15  
**Branch:** `main`  
**Author:** Chinthaka Jayaweera  
**Safety tag:** `pre-mongodb-main-20260715-0009`  
**Original main SHA (pre-work):** `214fc2b`  
**Migration commit:** `576d85d`  
**CI fix commit:** see `origin/main` tip after push

## Summary decision

**CODE_COMPLETE_DEPLOYMENT_BLOCKED**

Code, MongoDB Atlas `fg_online` schema sync, idempotent seed, local quality gate, and
same-origin `/api` proxy are complete. Live Render and Cloudflare Worker
deployments could not be executed from this environment because the required
CLI/API secrets were missing.

## Verified locally / Atlas

| Check | Result |
|-------|--------|
| Prisma provider | MongoDB |
| Active database | `fg_online` |
| `prisma db push` | PASS |
| Seed ×2 | PASS (idempotent) |
| GridFS module (`fgEvidence`) | Implemented + wired |
| Same-origin `/api` proxy | Implemented |
| Unit tests | PASS |
| `pnpm build` (api + web) | PASS |
| Secrets in git | None staged |

## External blockers (exact names)

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `RENDER_API_KEY`
- `RENDER_SERVICE_ID`

Optional once keys exist: `CLOUDFLARE_WORKER_NAME`, `FRONTEND_PUBLIC_URL`, `RENDER_API_URL`, `API_INTERNAL_URL` (Worker secret).

## Not claimed

- Public Cloudflare frontend smoke
- Render `/health/ready` against production service
- End-to-end browser login through workers.dev → Render → Atlas
- GitHub Actions green on this commit until push completes and Actions run

## Next operator steps (secret holders only)

1. Set Render env vars including `DATABASE_URL` → `fg_online`, JWT secrets, `COOKIE_SECURE=true`.
2. Deploy Nest from `main`.
3. Set Worker `API_INTERNAL_URL` to Render base URL (server-only).
4. Deploy OpenNext Worker; never set `DATABASE_URL` on Cloudflare.
5. Smoke login, draft/submit, evidence upload, reports.
