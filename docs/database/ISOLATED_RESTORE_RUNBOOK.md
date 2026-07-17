# Isolated Restore Runbook (FG-DR-001)

**Purpose:** Restore a MongoDB/GridFS backup into a **non-production** database and reconcile.  
**Never** restore onto `fg_online`.

---

## Preconditions

1. Encrypted backup archive + checksum available off-repo.
2. Isolated Atlas database created (e.g. `fg_online_restore_test`).
3. Operator has least-privilege credentials for source (read) and target (read/write).
4. Environment:

```bash
export ALLOW_ISOLATED_RESTORE_TEST=YES
export BACKUP_SOURCE_DATABASE_URL='…'   # do not print
export RESTORE_TEST_DATABASE_URL='…'    # isolated name only
```

5. Validator dry-run:

```bash
node scripts/disaster-recovery/restore-isolated.js
```

Must print `RESTORE_DRY_RUN` with distinct source/target database names.

---

## Execute restore

```bash
node scripts/disaster-recovery/restore-isolated.js \
  --execute \
  --archive=/secure/backups/fg_online_YYYYMMDD.archive
```

Requires `mongorestore` on PATH. On failure with missing tooling/credentials, treat as:

**BLOCKED_EXTERNAL_RESTORE_TARGET**

---

## Reconcile (read-only)

```bash
export DATABASE_URL="$RESTORE_TEST_DATABASE_URL"
node scripts/disaster-recovery/reconcile-all.js \
  --compare-manifest=/secure/backups/.../MANIFEST.json
```

Checks:

- collection names / counts  
- index manifest differences  
- sampled id hashes  
- GridFS files/chunks vs attachment metadata (orphans / missing)  
- relationship invariants (record→version, evidence, approvals, CA, user/role, current template version, audit refs)

---

## Pass criteria

| Gate | Required |
| --- | --- |
| Target validator | PASS |
| mongorestore exit 0 | PASS |
| Collection count reconcile | PASS (vs manifest) |
| GridFS orphan/missing | 0 critical missing; orphans explained |
| Invariant failures | 0 critical |
| App smoke against restore DB | PASS (optional but recommended) |

If any gate is skipped: record **NOT_EXECUTED** — do not claim restore PASS.

---

## Rollback responsibility

| Role | Responsibility |
| --- | --- |
| DBA / on-call | Execute isolated restore; never point production DNS/Render at restore DB without IT Manager approval |
| IT Manager | Authorize production cutover or abort |
| Developer | Support reconciliation interpretation; no production overwrite |

After a failed drill: drop or quarantine the restore database; revoke temporary credentials.
