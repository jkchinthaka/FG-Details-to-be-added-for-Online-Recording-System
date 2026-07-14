# Cloudflare + Render + MongoDB Atlas Architecture

**Product:** Nelna FG Digital Recording System  
**Developer:** Chinthaka Jayaweera  
**Branch:** `feature/cloudflare-render-deployment`

## Target topology

```text
Browser
  │
  ├─ HTTPS https://fg.nelna.lk
  │     └─ Cloudflare Worker (OpenNext / @opennextjs/cloudflare)
  │           NEXT_PUBLIC_API_URL=https://fg-api.nelna.lk
  │           (NO DATABASE_URL)
  │
  └─ HTTPS https://fg-api.nelna.lk  (cookies Domain=.nelna.lk)
        └─ Render Web Service (NestJS monorepo root build)
              DATABASE_URL → MongoDB Atlas `fg_online`
```

## Environments

| Tier | Frontend | API | Database |
|------|----------|-----|----------|
| UAT | Worker `nelna-fg-web-uat` | Render `nelna-fg-api-uat` | `fg_online_uat` |
| Production | `fg.nelna.lk` | `fg-api.nelna.lk` | `fg_online` |

UAT must never write to `fg_online`. Enforced via `NELNA_DEPLOY_TIER=uat` production env validation.

## Auth cookie flow

1. Login on `fg-api.nelna.lk` sets HttpOnly + Secure + SameSite=Lax cookies with `Domain=.nelna.lk`.
2. Browser sends cookies to both `fg.nelna.lk` (middleware session check forwards Cookie header to API) and `fg-api.nelna.lk` (XHR `credentials: include`).
3. Tokens never readable from frontend JavaScript.

## Blocking dependency

**Do not deploy to UAT/production until MongoDB Atlas migration is completed and verified** on `feature/mongodb-atlas-migration` (or merged). Current `develop` Prisma provider remains PostgreSQL.

## Related docs

- `DEPLOYMENT_READINESS_AUDIT.md`
- `RENDER_BACKEND_SETUP.md`
- `CLOUDFLARE_WORKERS_SETUP.md`
- `MONGODB_ATLAS_SETUP.md`
- `CUSTOM_DOMAIN_AND_COOKIE_SETUP.md`
- `UAT_DEPLOYMENT_CHECKLIST.md`
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `ROLLBACK_PLAN.md`
