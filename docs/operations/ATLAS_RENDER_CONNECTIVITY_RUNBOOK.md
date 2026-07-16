# Atlas ↔ Render Connectivity Runbook

**Purpose:** Restore MongoDB Atlas reachability from the Render API so `/health/ready` returns 200.  
**Safety:** Never disable TLS. Never set `tlsAllowInvalidCertificates=true`. Never print `DATABASE_URL`.

## Observed failure pattern

- Prisma / Mongo `ReplicaSetNoPrimary` or server selection timeout
- Atlas TLS / InternalError during connect
- Render `/health/live` = 200 while `/health/ready` = 503 with `db:down`

## MongoDB Atlas checks

1. Cluster status is **AVAILABLE** (primary elected).
2. Database Access user exists; password matches Render secret (URI-encode special characters).
3. User has **readWrite** (or equivalent) on database `fg_online`.
4. Network Access includes **Render Singapore outbound CIDR ranges** for this service.
5. Do **not** leave a permanent `0.0.0.0/0` rule as the long-term control.
6. Connection string path includes `/fg_online`.
7. TLS remains enabled (`mongodb+srv` / TLS options).
8. Cluster region is healthy.

## Render checks

1. Service region (expected: Singapore).
2. Outbound CIDR ranges recorded and mirrored in Atlas Network Access.
3. `DATABASE_URL` present as a secret (Dashboard only).
4. `NODE_VERSION` = `22.16.0`.
5. Health check path = `/health/ready`.
6. Build / start commands match `render.yaml` (no seed/bootstrap in Start Command).

## Local / operator diagnostic

```bash
pnpm --filter @nelna/api db:diagnose
```

Safe output fields only: provider, SRV flag, database name, DNS/TLS/ping/replica status, elapsed ms.

For production cutover commands that mutate data, also set:

```bash
NELNA_REQUIRE_PRODUCTION_DB=true
```

## Verification curls

```bash
curl -i https://fg-details-to-be-added-for-online.onrender.com/health/live
curl -i https://fg-details-to-be-added-for-online.onrender.com/health/ready
curl -i https://fgdetails.chinthakajayaweera1.workers.dev/api/health/live
curl -i https://fgdetails.chinthakajayaweera1.workers.dev/api/health/ready
```

**PASS criteria:**

- Direct live = 200
- Direct ready = 200 with `checks.db=up`
- Proxied live/ready = 200 (if Worker returns 403, fix Cloudflare proxy/env/deploy before claiming alignment)

## MANUAL_ACTION_REQUIRED

Atlas Network Access, Database Access password rotation, and Render secret updates require authenticated console access. Repository code cannot complete those steps alone.
