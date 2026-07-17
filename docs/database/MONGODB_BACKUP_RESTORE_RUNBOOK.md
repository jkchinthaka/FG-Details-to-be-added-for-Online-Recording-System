# MongoDB Atlas + GridFS Backup & Restore Runbook

**Audience:** IT Manager, DBAs, on-call engineers  
**Stack:** MongoDB Atlas (`fg_online`) + GridFS bucket `fgEvidence`  
**Finding:** FG-DR-001  
**Last reviewed:** 2026-07-17  

**Live restore evidence:** see `ISOLATED_RESTORE_RUNBOOK.md` and `docs/release/FINAL_RESTORE_SUMMARY.md`.  
Do **not** claim restore PASS without execution evidence.

---

## 1. Goal

Protect structured collections **and** GridFS evidence binaries so a disaster can be recovered into an **isolated** database without silent loss or production overwrite.

---

## 2. Safety invariants

| Rule | Enforcement |
| --- | --- |
| Never restore over production `fg_online` | `validateIsolatedRestoreTarget` + restore wrapper |
| Never print connection strings | Redaction helpers in all DR scripts |
| Never commit backup archives | `.local-backups/` gitignored; manifests mark `doNotCommit` |
| Read-only verification is default | `verify-backup.js`, `reconcile-all.js` |
| Destructive restore needs explicit flags | `ALLOW_ISOLATED_RESTORE_TEST=YES` + `--execute` |

Required environment for restore exercises:

```bash
export ALLOW_ISOLATED_RESTORE_TEST=YES
export BACKUP_SOURCE_DATABASE_URL='…'   # never echo
export RESTORE_TEST_DATABASE_URL='…'    # must be isolated name
```

Allowed restore target names: `fg_online_test`, `fg_online_restore_test`, `fg_online_uat`, `fg_dr_restore`, `fg_dr_restore_<suffix>`.

---

## 3. Atlas continuous backup (primary)

1. Enable **Cloud Backup** on the Atlas cluster (IT Manager).
2. Confirm snapshot schedule and retention match Nelna policy.
3. Confirm point-in-time restore (PITR) if licensed.
4. Store encryption / key custody per Nelna IT (never in git).

Atlas snapshots cover collections **and** GridFS (`fgEvidence.files` / `.chunks`).

---

## 4. Logical backup (secondary / portable)

### Ops script (production source only)

```bash
# DATABASE_URL must resolve to database name fg_online
node scripts/database/backup-fg-online.js
```

Output under `.local-backups/` (gitignored): per-collection JSON, GridFS metadata, sampled binaries, `MANIFEST.json`.

### Manifest generate / verify

```bash
node scripts/disaster-recovery/generate-backup-manifest.js --dir=.local-backups/<folder> --database=fg_online
node scripts/disaster-recovery/verify-backup.js --dir=.local-backups/<folder>
```

### mongodump (recommended for restore drills)

```bash
# Operators supply URIs via env — do not paste into tickets
mongodump --uri="$BACKUP_SOURCE_DATABASE_URL" --archive=/secure/backups/fg_online_$(date +%Y%m%d).archive --gzip
sha256sum /secure/backups/fg_online_*.archive > /secure/backups/fg_online_*.sha256
```

---

## 5. Encrypted backup & secret handling

| Control | Guidance |
| --- | --- |
| At rest | Store archives on encrypted volume / SSE bucket; BitLocker/LUKS for removable media |
| In transit | TLS only (`mongodb+srv` / Atlas) |
| Credentials | Backup role least privilege; rotate after staff changes; never commit `.env` |
| Sharing | Transfer checksums + redacted manifests only; never paste URIs into chat/git |
| Redaction | DR reports use `redactReport` — connection strings become `[REDACTED_MONGO_URI]` |

---

## 6. Related tooling

| Script | Purpose |
| --- | --- |
| `scripts/disaster-recovery/restore-isolated.js` | Validated restore wrapper |
| `scripts/disaster-recovery/reconcile-all.js` | Collections + GridFS + invariants |
| `scripts/database/reconcile-evidence-orphans.js` | Orphan/missing GridFS maintenance |

---

## 7. RPO / RTO planning targets

| Metric | Planning target | Status |
| --- | --- | --- |
| RPO | ≤ 24 hours (Atlas daily snapshot); prefer PITR ≤ 1 hour when enabled | **NOT_EXECUTED** until drill |
| RTO | ≤ 4 hours (restore + reconcile + smoke) | **NOT_EXECUTED** until drill |

Record measurements with `buildRpoRtoRecord` / quarterly exercise form. These are **not** SLAs until IT Manager adopts them.

---

## 8. Obsolete PostgreSQL material

- `BACKUP_RESTORE_RUNBOOK.md` (stub)  
- `scripts/db/backup.ps1`, `backup.sh`, `restore.ps1`  
- SQL `DATA_RECONCILIATION.md`  

See `DR_DOCUMENT_CLASSIFICATION.md`.
