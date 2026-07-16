# Deployment Rollback Plan — Cloudflare / Render / Atlas

FG-DEP-001: Rollbacks are based on **immutable Git commits**, never on
mutable “latest” labels or random framework build ids.

## Principles

1. Prefer rollback at the edge (Worker version / Render deploy) before touching data.
2. Never restore Atlas over production during a drill — use a separate restore target.
3. Keep PostgreSQL archive available until Mongo cutover is proven (migration branch).
4. Every production deploy must expose the same `commitSha` on:
   - Render API: `GET /health/release`
   - Cloudflare Worker: `GET /release` (and `/release-manifest.json`)
5. Verify with:
   ```bash
   EXPECTED_COMMIT_SHA=<40-char-sha> \
   FRONTEND_PUBLIC_URL=https://<worker> \
   API_PUBLIC_URL=https://<render> \
   pnpm release:verify-alignment
   ```

## Identify the authorized commit

1. Read the Release ID (12-char `shortSha`) from System status UI, or:
2. `curl -sS https://<api>/health/release | jq .commitSha`
3. `curl -sS https://<worker>/release | jq .commitSha`
4. Confirm both match the authorized Git SHA before any traffic cutover.

## Frontend (Cloudflare)

1. Instant rollback to previous Worker version in Cloudflare dashboard / Wrangler versions.
2. Or redeploy a known-good commit:
   ```bash
   git checkout <authorized-sha>
   export GIT_COMMIT_SHA=$(git rev-parse HEAD)
   export APP_BUILD_ID=$GIT_COMMIT_SHA
   pnpm --filter @nelna/shared build && pnpm --filter @nelna/ui build
   pnpm --filter @nelna/web deploy
   ```
3. Confirm `/release` returns that SHA, then re-run alignment verification.
4. If DNS misconfigured, temporarily point `fg.nelna.lk` away from broken Worker.

## Backend (Render)

1. Rollback to previous Render deploy **for the same authorized Git SHA**, or
   trigger a redeploy of that commit from the Render dashboard / Git auto-deploy.
2. Confirm Start Command remains:
   `pnpm --filter @nelna/api start:prod`
   — never add bootstrap, seed, index sync or migration commands.
3. Confirm `/health/ready` and `/health/release` (commitSha).
4. If env mis-set (wrong DB), restore secrets and restart — do not “fix” by pointing UAT secrets at prod.

## Database

1. If Mongo migration not cut over yet: keep API on previous provider/config.
2. If Atlas data issue: restore from Atlas backup into **non-prod** first; reconcile counts.
3. Do not delete PostgreSQL source until migration reconciliation PASS.

## Auth emergency

If cookies break across subdomains:

1. Verify `COOKIE_DOMAIN=.nelna.lk` and `COOKIE_SECURE=true` (or same-origin cookie mode).
2. Clear site cookies for `nelna.lk`.
3. Re-login.

## Communication

Record incident time, rolled-back SHAs (`shortSha` + full `commitSha`), alignment
verification result, and whether any writes occurred on the wrong database.
