# UAT Deployment Checklist

**Do not start UAT until MongoDB migration is verified.**

## Preconditions

- [ ] `feature/mongodb-atlas-migration` merged or otherwise available  
- [ ] Atlas database `fg_online_uat` created  
- [ ] Prisma `db push` + idempotent seed against UAT  
- [ ] This deployment branch quality gate green  

## Render UAT API

- [ ] Service `nelna-fg-api-uat` created from monorepo root  
- [ ] `NELNA_DEPLOY_TIER=uat`  
- [ ] `DATABASE_URL` → `fg_online_uat` only  
- [ ] `API_CORS_ORIGIN` = UAT frontend origin (not `https://fg.nelna.lk`)  
- [ ] `COOKIE_SECURE=true`, `COOKIE_DOMAIN=.nelna.lk`  
- [ ] Health: `GET /health/ready` returns ready  
- [ ] `GET /health/database-config` shows MongoDB + `fg_online_uat`  

## Cloudflare UAT Worker

- [ ] Deploy `wrangler` env `uat`  
- [ ] `NEXT_PUBLIC_API_URL` points at UAT API  
- [ ] No `DATABASE_URL` on Worker  

## Smoke (record evidence)

- [ ] Login / refresh / logout  
- [ ] Role routes  
- [ ] Daily cleaning + truck draft/submit  
- [ ] Reports / PDF  
- [ ] Offline queue basic path  
- [ ] CORS rejection from unapproved origin  

## Decision

- CONTINUE / FIX_AND_REPEAT / STOP  

**Current prep status:** UAT **not safe** until Mongo migration is done.
