# Environment Matrix — Nelna FG Digital Recording System

| Dimension | Development | Test / UAT | Production |
|-----------|-------------|------------|------------|
| Purpose | Feature work | Acceptance & integration | Live plant records |
| Web host | `localhost:3000` | Staging URL (TBD by IT) | Public HTTPS hostname (TBD) |
| API host | `localhost:3001` | Staging API (TBD) | Private/public HTTPS API (TBD) |
| PostgreSQL | Local / Docker | Shared UAT instance | Managed HA preferred |
| `NODE_ENV` | `development` | `production` or `test` (prefer prod-like) | `production` |
| Secrets | Dev placeholders OK | Non-prod secrets vault | Production vault only |
| `COOKIE_SECURE` | `false` | `true` if HTTPS | `true` (enforced) |
| Seed users | Optional env-driven | Yes, controlled passwords | Prefer admin provisioning; seed carefully |
| Migrations | `migrate dev` | `migrate deploy` | `migrate deploy` only |
| Backups | Optional | Daily + pre-release | Daily + WAL if available |
| Monitoring | Optional | Basic uptime | Full alert set |
| Data | Disposable | Realistic anonymized where possible | Real quality records |
| Who deploys | Developers | IT + developer | IT Manager authorization required |

## Variable checklist (all non-dev)

- [ ] `DATABASE_URL`  
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (unique, strong)  
- [ ] `API_CORS_ORIGIN`  
- [ ] `COOKIE_SECURE=true`  
- [ ] `APP_VERSION` / `APP_BUILD_ID`  
- [ ] `FILE_STORAGE_PATH` (if local files)  
- [ ] Web API base URL  

## Promotion path

`develop` → build → Test/UAT → (signed UAT) → production tag → deploy with checklist.
