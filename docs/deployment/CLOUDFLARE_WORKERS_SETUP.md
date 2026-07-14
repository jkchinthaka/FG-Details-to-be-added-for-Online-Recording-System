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

## Production vars

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://fg-api.nelna.lk` |
| `API_INTERNAL_URL` (optional) | same as above for middleware |

**Never** set `DATABASE_URL` on the Worker.

## Domain

Configure DNS for `fg.nelna.lk` → Worker route (see `wrangler.jsonc` `routes` / Cloudflare dashboard). Zone must be on Cloudflare.

## UAT

Use Wrangler env `uat` (`nelna-fg-web-uat`) with UAT API URL. Do not point UAT Worker at production API long-term without an explicit waiver.

## Manual steps still required

1. Cloudflare account + API token  
2. Zone `nelna.lk` active on Cloudflare  
3. `wrangler login` / CI secrets  
4. Actual `pnpm --filter @nelna/web deploy` after MongoDB migration is ready  

Preview/deploy success is **not** claimed until executed with credentials.
