# Backup & Restore Runbook — Nelna FG Digital Recording System

**Audience:** IT Manager, DBAs, on-call engineers  
**Database:** PostgreSQL via Prisma (`DATABASE_URL`)  
**Last reviewed:** 2026-07-14 (Prompt 39)  
**Latest dynamic restore evidence:** **NOT EXECUTED** — see `RESTORE_TEST_EVIDENCE.md`

---

## 1. Goal

Protect historical quality records (inspection results, approvals, corrective actions, audit logs, attachment **metadata**, template versions) so they can be restored without silent loss.

Attachment **binary files** live outside Postgres (see ADR file-storage). Always back up object storage / file root in the same recovery window as the database.

---

## 2. Safe local / test backup procedure

### Prerequisites

- `pg_dump` / `psql` matching (or compatible with) server major version  
- Read-only or app DB credentials with `CONNECT` + `SELECT` (dump)  
- Write space on encrypted volume  
- Never commit dump files to git  

### Logical backup (recommended for MVP / UAT)

PowerShell (Windows):

```powershell
# From repo root; requires DATABASE_URL or explicit connection params
.\scripts\db\backup.ps1 -OutputDir "C:\secure-backups\nelna-fg"
```

Bash (Linux/macOS CI runners):

```bash
./scripts/db/backup.sh /secure-backups/nelna-fg
```

What the scripts produce:

| Artifact | Contents |
|----------|----------|
| `nelna_fg_YYYYMMDD_HHMMSS.dump` | Custom-format (`pg_dump -Fc`) full DB |
| `nelna_fg_YYYYMMDD_HHMMSS.sha256` | Checksum of the dump |
| `nelna_fg_YYYYMMDD_HHMMSS.counts.json` | Pre-backup row counts (if `psql` + reconcile SQL succeeds) |

### Manual equivalent

```bash
pg_dump -Fc --no-owner --no-acl -f "nelna_fg_$(date +%Y%m%d_%H%M%S).dump" "$DATABASE_URL"
sha256sum nelna_fg_*.dump > nelna_fg_*.sha256   # or Get-FileHash on Windows
```

### Schema-only snapshot (optional, for change review)

```bash
pg_dump --schema-only -f schema_YYYYMMDD.sql "$DATABASE_URL"
```

---

## 3. Restore procedure (test environment)

**Never restore a test dump over production without an explicit maintenance window and dual authorization.**

### Target: empty or disposable database

```bash
# 1. Create empty DB (example)
createdb nelna_fg_restore_test

# 2. Verify checksum
sha256sum -c nelna_fg_YYYYMMDD_HHMMSS.sha256

# 3. Restore
pg_restore --clean --if-exists --no-owner --no-acl -d "$RESTORE_DATABASE_URL" nelna_fg_YYYYMMDD_HHMMSS.dump

# 4. Reconcile counts — see DATA_RECONCILIATION.md
psql "$RESTORE_DATABASE_URL" -f scripts/db/reconcile_counts.sql
```

PowerShell helper:

```powershell
.\scripts\db\restore.ps1 -DumpPath "C:\secure-backups\nelna-fg\nelna_fg_....dump" -DatabaseUrl $env:RESTORE_DATABASE_URL
```

### After restore

1. Point a **non-production** API at the restored DB.  
2. Run migration status: `prisma migrate status` (should show applied history intact).  
3. Compare counts vs pre-backup JSON.  
4. Spot-check critical sample records (template version binding, CA links, truck loading block flags).  
5. Confirm file storage paths still resolve for sampled attachments.

---

## 4. Policy recommendations

| Topic | Recommendation |
|-------|----------------|
| **Backup frequency** | Production: full logical dump **daily**; WAL/continuous archiving if PostgreSQL hosting supports it. Pre-migration / pre-release: **mandatory** on-demand dump. |
| **Retention** | Daily: 14 days; weekly: 8 weeks; monthly: 12 months (or per Nelna IT policy if stricter). |
| **Encryption** | Encrypt dumps at rest (BitLocker / LUKS / object-store SSE). In transit: TLS to DB and to offsite storage. |
| **Access control** | Backup share limited to DBAs + IT Manager. No developer laptops as sole production backup target. Rotate credentials that can read dumps. |
| **Offsite copy** | Copy encrypted dumps to a second site or cloud bucket in a different failure domain within 24 hours. |
| **Restore-test frequency** | Quarterly restore into disposable DB + reconciliation; additionally before every production major release. |
| **RPO** | Recommended MVP target: **≤ 24 hours** (daily dumps). Prefer **≤ 1 hour** once WAL archiving is enabled. |
| **RTO** | Recommended MVP target: **≤ 4 hours** for DB restore + app redeploy + smoke tests during business hours. |

These are planning targets for Nelna IT to confirm; they are not SLAs unless adopted by IT Manager.

---

## 5. What this environment demonstrated (Prompt 21)

| Step | Result |
|------|--------|
| Prisma validate | **PASS** |
| Migration inventory / ordering review | **PASS** (documented) |
| Live `migrate deploy` against localhost | **NOT EXECUTED** — PostgreSQL authentication failed (`P1000`); Docker daemon unavailable |
| Live backup (`pg_dump`) | **NOT EXECUTED** — no authenticated DB |
| Live restore test | **NOT EXECUTED** — no authenticated DB |

See `RESTORE_TEST_EVIDENCE.md` for the formal evidence record. **Do not treat restore as proven until a real restore is performed and reconciled.**

---

## 6. Related documents

- `MIGRATION_RUNBOOK.md`  
- `DATA_RECONCILIATION.md`  
- `RESTORE_TEST_EVIDENCE.md`  
- `../operations/DEPLOYMENT_RUNBOOK.md` (when published)  

---

*Do not claim a restore test passed unless it was actually performed.*
