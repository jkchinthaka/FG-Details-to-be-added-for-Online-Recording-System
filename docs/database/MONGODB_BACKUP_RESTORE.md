# MongoDB Atlas + GridFS backup and restore

Replaces PostgreSQL/WAL assumptions for the FG Online system.

## Scope

- Database: MongoDB Atlas `fg_online` (production) / isolated restore targets only
- Files: GridFS bucket `fgEvidence`

## Backup

1. Use encrypted Atlas continuous backup / snapshot per org policy.
2. Optionally run `node scripts/database/backup-fg-online.js` against an authorized environment (never log credentials).
3. Verify backup integrity: snapshot status OK + collection counts recorded.

## Restore (isolated target only)

**Never restore over production.**

Required before restore:

- Explicit isolated cluster/database name ≠ `fg_online`
- Written authorization

If missing: **BLOCKED_EXTERNAL_RESTORE_TARGET**

### Verification checklist

- [ ] Collection document counts reconcile to backup manifest
- [ ] Relationship/invariant checks (template currentVersion, username unique)
- [ ] GridFS file count matches `fgEvidence.files`
- [ ] Sampled binary download + SHA-256 compare
- [ ] RPO measurement (minutes of acceptable data loss)
- [ ] RTO measurement (time to restore readiness)

Do not claim restore PASS without real execution evidence.
