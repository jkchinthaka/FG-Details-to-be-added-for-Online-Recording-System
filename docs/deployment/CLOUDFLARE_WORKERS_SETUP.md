# Cloudflare Workers Setup — Nelna FG Web

## Approach

Next.js App Router via **`@opennextjs/cloudflare`** (not static export).

## Key files

| File | Purpose |
|------|---------|
| `apps/web/wrangler.jsonc` | Worker name, assets, `fg.nelna.lk` route, prod API URL var |
| `apps/web/open-next.config.ts` | OpenNext Cloudflare config |
| `apps/web/public/_headers` | Static asset cache headers |
| `apps/web/next.config.ts` | `initOpenNextCloudflareForDev()` + CSP `connect-src` to API |

## Scripts (`apps/web`)

```bash
pnpm --filter @nelna/web preview   # Workers runtime preview (not only next dev)
pnpm --filter @nelna/web deploy    # Build + deploy (requires Cloudflare auth)
pnpm --filter @nelna/web upload    # Upload version without promoting
pnpm --filter @nelna/web cf-typegen
```

Build shared packages first: `pnpm --filter @nelna/shared build && pnpm --filter @nelna/ui build`.

## Production vars (`wrangler.jsonc`)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `/api` |
| `API_INTERNAL_URL` | `https://fg-details-to-be-added-for-online.onrender.com` (no `/api` suffix) |

**Never** set `DATABASE_URL`, JWT secrets, or Mongo credentials on the Worker.

Production OpenNext builds validate these vars and fail on localhost/private/`/api` suffix.

## Domain

Production currently uses `workers.dev` (`fgdetails`). Configure DNS for `fg.nelna.lk` → Worker route only after the zone is active on Cloudflare.

## UAT

Use Wrangler env `uat` (`fgdetails-uat`). **MANUAL_ACTION_REQUIRED:** set an explicit UAT `API_INTERNAL_URL` before deploy — do not copy the production Render URL.

## Manual steps still required

1. Cloudflare account + API token  
2. Zone `nelna.lk` active on Cloudflare  
3. `wrangler login` / CI secrets  
4. Actual `pnpm --filter @nelna/web deploy` after MongoDB migration is ready  

Preview/deploy success is **not** claimed until executed with credentials.
