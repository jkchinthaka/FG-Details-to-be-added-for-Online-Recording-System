# MongoDB Atlas Setup — Deployment Perspective

## Databases

| Environment | Database name |
|-------------|---------------|
| Production | `fg_online` |
| UAT | `fg_online_uat` |
| Automated tests | `fg_online_test` |

## Who receives `DATABASE_URL`

**Only the Render NestJS service.**

Cloudflare Workers must never receive the connection string.

## Placeholder (safe for docs / `.env.example`)

```env
DATABASE_URL="mongodb+srv://<DB_USER>:<DB_PASSWORD>@cluster0.gsqzhij.mongodb.net/fg_online?retryWrites=true&w=majority&appName=Cluster0"
```

Real credentials live only in untracked `apps/api/.env` and Render secret env.

## Atlas checklist

- [ ] Database user with least privilege  
- [ ] Network Access: Render egress IPs (or approved CIDR)  
- [ ] Separate DB or user for UAT  
- [ ] Password rotated if ever pasted into chat  
- [ ] Prisma MongoDB migration completed (`db push` + idempotent seed)  
- [ ] `/health/ready` fails when Atlas unreachable  
- [ ] `/health/database-config` shows provider MongoDB + name only (no host/password)

## Blocking note

On `develop` / this deployment branch, Prisma may still be **PostgreSQL** until `feature/mongodb-atlas-migration` merges. Production env validation already **requires** `mongodb`/`mongodb+srv` and DB name `fg_online` when `NODE_ENV=production` — the API will refuse to start against Postgres in production mode.

Do **not** claim Atlas connection, `db push`, or seed success from this deployment-prep branch alone.
