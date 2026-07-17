# Reconciliation Report Template (MongoDB + GridFS)

**Exercise ID:**  
**Date:**  
**Operator:**  
**Source backup ID / SHA-256:**  
**Target database name:** (must not be `fg_online`)  
**Git SHA of tooling:**  

---

## 1. Safety gate

| Check | Result |
| --- | --- |
| `ALLOW_ISOLATED_RESTORE_TEST=YES` | |
| Source ≠ target | |
| Target not `fg_online` | |
| Connection strings redacted in this report | YES (mandatory) |

---

## 2. Collection counts

| Collection | Source | Target | Match? |
| --- | --- | --- | --- |
| users | | | |
| inspection_records | | | |
| inspection_results | | | |
| inspection_attachments | | | |
| approval_records | | | |
| corrective_actions | | | |
| checklist_template_versions | | | |
| audit_logs | | | |
| … | | | |

Attach `reconcile-all.js` JSON (redacted).

---

## 3. Index manifest

| Collection | Source index hash | Target index hash | Match? |
| --- | --- | --- | --- |
| checklist_templates | | | |

---

## 4. GridFS

| Metric | Value |
| --- | --- |
| files count | |
| chunks count | |
| referenced metadata links | |
| missing binaries | |
| orphan binaries | |
| sampled download hash verify | PASS / FAIL / NOT_EXECUTED |

---

## 5. Invariants

| Check | Result |
| --- | --- |
| record → template version | |
| record → evidence | |
| record → approvals | |
| corrective action → source result/record | |
| user/role relations | |
| current template version | |
| audit references | |

---

## 6. RPO / RTO

| Metric | Planning target | Measured |
| --- | --- | --- |
| RPO (minutes) | 1440 | NOT_EXECUTED / number |
| RTO (minutes) | 240 | NOT_EXECUTED / number |

---

## 7. Overall

**Result:** PASS / FAIL / NOT_EXECUTED / BLOCKED_EXTERNAL_RESTORE_TARGET  

**Notes:**
