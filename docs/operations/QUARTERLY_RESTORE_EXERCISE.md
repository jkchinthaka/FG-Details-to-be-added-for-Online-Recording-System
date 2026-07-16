# Quarterly Restore Exercise

**Cadence:** Once per quarter + before major production releases  
**Owner:** IT Manager (sponsor) · DBA (executor) · Developer (reconcile support)

---

## Checklist

1. [ ] Confirm Atlas snapshot / logical archive exists; record backup ID + SHA-256  
2. [ ] Create or reset isolated DB (`fg_online_restore_test` or `fg_dr_restore_YYYYMM`)  
3. [ ] Set `ALLOW_ISOLATED_RESTORE_TEST=YES` + source/target URLs (never log them)  
4. [ ] `node scripts/disaster-recovery/restore-isolated.js` → dry-run PASS  
5. [ ] `node scripts/disaster-recovery/restore-isolated.js --execute --archive=…`  
6. [ ] `DATABASE_URL=<restore> node scripts/disaster-recovery/reconcile-all.js`  
7. [ ] Fill `RECONCILIATION_REPORT_TEMPLATE.md`  
8. [ ] Record RPO/RTO timestamps (or **NOT_EXECUTED**)  
9. [ ] Destroy or quarantine restore DB; rotate temporary credentials  
10. [ ] File exercise report under `reports/` (gitignored) or secure share — **do not commit dumps**

---

## Result codes

| Code | Meaning |
| --- | --- |
| PASS | Restore + reconcile completed with evidence |
| FAIL | Execute attempted; reconciliation or restore failed |
| NOT_EXECUTED | Steps not run |
| BLOCKED_EXTERNAL_RESTORE_TARGET | No authorized isolated credentials/target/tooling |

**Current default until a drill runs:** `BLOCKED_EXTERNAL_RESTORE_TARGET` / measured RPO/RTO **NOT_EXECUTED**.
