# Disaster Recovery Plan — Nelna FG Digital Recording System

**Finding:** FG-DR-001  
**Primary datastore:** MongoDB Atlas database `fg_online` + GridFS `fgEvidence`  
**API host:** Render · **Web host:** Cloudflare Workers  

---

## 1. Scope

Recoverability of:

- Application collections (users, templates, inspection records, approvals, corrective actions, audit logs, …)
- GridFS evidence binaries and metadata links
- Ability to redeploy API/web pinned to a known Git SHA (see release alignment)

Out of scope: inventing Nelna business RPO/RTO SLAs (planning targets only until IT Manager adopts).

---

## 2. Failure scenarios

| Scenario | Initial response |
| --- | --- |
| Atlas regional outage | Fail over per Atlas / wait for provider; communicate ETA |
| Logical corruption / bad deploy | Stop writes; restore to isolated DB; reconcile; cut over only with approval |
| Accidental deletion | PITR / snapshot restore into isolated DB first |
| GridFS orphan/missing binaries | `reconcile-all.js` + `reconcile-evidence-orphans.js` (read-only first) |
| Credential leak | Rotate Atlas/Render secrets; invalidate refresh families |

---

## 3. Ownership & escalation

| Role | Ownership |
| --- | --- |
| IT Manager | Go/no-go on production restore cutover; vendor escalation |
| DBA / platform owner | Atlas backups, restore execution, encryption custody |
| On-call engineer | Detection, isolation, runbook execution, status page/comms draft |
| Application developer | Reconciliation interpretation, app smoke, release SHA alignment |
| Food Safety / QA lead | Business acceptance that restored records are usable (when required) |

**Escalation:** On-call → IT Manager (15 min for production write loss) → Atlas support (IT Manager).

---

## 4. Rollback responsibility

1. Prefer **forward fix** deploy when data is intact.  
2. Prefer **Atlas PITR/snapshot → isolated DB → reconcile → cut over** for data loss.  
3. **Never** `mongorestore --drop` onto `fg_online` from a laptop without dual authorization and a change ticket.  
4. Record backup ID, checksum, operator, start/end times, RPO/RTO measurements.

---

## 5. Tooling map

See `docs/database/MONGODB_BACKUP_RESTORE_RUNBOOK.md` and `scripts/disaster-recovery/`.

---

## 6. Evidence status

| Item | Status |
| --- | --- |
| Tooling + fixture tests | Implemented (FG-DR-001) |
| Live isolated restore drill | **BLOCKED_EXTERNAL_RESTORE_TARGET** until credentials/target exist |
| Measured RPO/RTO | **NOT_EXECUTED** |
