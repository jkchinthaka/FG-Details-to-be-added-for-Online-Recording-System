# Deployment Rollback Plan — Cloudflare / Render / Atlas

## Principles

1. Prefer rollback at the edge (Worker version / Render deploy) before touching data.  
2. Never restore Atlas over production during a drill — use a separate restore target.  
3. Keep PostgreSQL archive available until Mongo cutover is proven (migration branch).

## Frontend (Cloudflare)

1. Instant rollback to previous Worker version in Cloudflare dashboard / Wrangler versions.  
2. Or redeploy last known-good git SHA of web build.  
3. If DNS misconfigured, temporarily point `fg.nelna.lk` away from broken Worker.

## Backend (Render)

1. Rollback to previous Render deploy.  
2. Confirm `/health/ready` and CORS origin.  
3. If env mis-set (wrong DB), restore secrets and restart — do not “fix” by pointing UAT secrets at prod.

## Database

1. If Mongo migration not cut over yet: keep API on previous provider/config.  
2. If Atlas data issue: restore from Atlas backup into **non-prod** first; reconcile counts.  
3. Do not delete PostgreSQL source until migration reconciliation PASS.

## Auth emergency

If cookies break across subdomains:

1. Verify `COOKIE_DOMAIN=.nelna.lk` and `COOKIE_SECURE=true`.  
2. Clear site cookies for `nelna.lk`.  
3. Re-login.

## Communication

Record incident time, rolled-back SHAs, and whether any writes occurred on the wrong database.
