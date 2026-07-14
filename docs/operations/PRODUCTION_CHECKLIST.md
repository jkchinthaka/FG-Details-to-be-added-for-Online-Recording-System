# Production Checklist — Nelna FG Digital Recording System

**Do not tick “Deployed” unless production was actually updated.**

## Pre-authorization

- [ ] IT Manager written approval  
- [ ] UAT sign-off or documented CONDITIONAL waiver  
- [ ] High/Critical defects accepted or closed (`docs/uat/DEFECT_REGISTER.md`)  
- [ ] Backup + offsite copy verified recent  
- [ ] Rollback owner named  

## Configuration

- [ ] Secrets in vault (not in git)  
- [ ] `assertProductionEnv` satisfied  
- [ ] CORS origin exact match to web URL  
- [ ] HTTPS certificates valid  
- [ ] `FILE_STORAGE_PATH` or object storage ready  
- [ ] `APP_VERSION` / `APP_BUILD_ID` set  

## Data

- [ ] Pre-deploy `pg_dump` + checksum  
- [ ] `migrate status` reviewed  
- [ ] `migrate deploy` completed  
- [ ] Row-count sample captured  

## Application

- [ ] API artifact deployed  
- [ ] Web artifact deployed  
- [ ] `/health/live` OK  
- [ ] `/health/ready` OK  
- [ ] Smoke tests (`SMOKE_TESTS.md`) passed  
- [ ] Monitoring alerts armed  

## Post

- [ ] Post-deployment report filed  
- [ ] Stakeholders notified  
- [ ] Paper contingency standing down (if used)  

## Prompt 23 status

Production deploy executed in this gate: **No**.
