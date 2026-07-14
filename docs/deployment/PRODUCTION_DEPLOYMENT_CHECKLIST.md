# Production Deployment Checklist

**Production gate remains subject to FG release NO-GO rules.**  
Do not promote until UAT smoke passes and MongoDB evidence exists.

## Preconditions

- [ ] UAT checklist completed with evidence  
- [ ] Atlas `fg_online` ready; backup strategy documented  
- [ ] Secrets in Render only  
- [ ] DNS: `fg.nelna.lk`, `fg-api.nelna.lk`  

## Render production API

- [ ] `NELNA_DEPLOY_TIER=production`  
- [ ] `DATABASE_URL` → `fg_online`  
- [ ] `API_CORS_ORIGIN=https://fg.nelna.lk`  
- [ ] `COOKIE_DOMAIN=.nelna.lk`, `COOKIE_SECURE=true`  
- [ ] `/health/ready` green  

## Cloudflare production Worker

- [ ] Route `fg.nelna.lk`  
- [ ] `NEXT_PUBLIC_API_URL=https://fg-api.nelna.lk`  
- [ ] No database secrets on Worker  

## Post-deploy smoke

- [ ] Cookie Domain=.nelna.lk observed  
- [ ] Login / refresh / logout  
- [ ] Core FG workflows  
- [ ] Readiness fails if Atlas paused (controlled test in UAT preferred)

## Claims

Do not mark PRODUCTION_READY without signed evidence. This prep PR alone does **not** constitute production deployment success.
