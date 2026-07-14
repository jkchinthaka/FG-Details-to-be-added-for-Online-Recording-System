# Data Reconciliation — Nelna FG Digital Recording System

## Prompt 39 status

**RECONCILIATION NOT EXECUTED** — no before/after dumps or empty restore target were available in this session. The procedure below remains the operational checklist.

---

---

## 1. Counts to reconcile

| Metric | SQL source | Critical? |
|--------|------------|-----------|
| User count | `COUNT(*) FROM "User"` | Yes |
| Template count | `COUNT(*) FROM "ChecklistTemplate"` | Yes |
| Template version count | `COUNT(*) FROM "ChecklistTemplateVersion"` | Yes |
| Record count | `COUNT(*) FROM "InspectionRecord"` | Yes |
| Result count | `COUNT(*) FROM "InspectionResult"` | Yes |
| Approval count | `COUNT(*) FROM "ApprovalRecord"` | Yes |
| Corrective action count | `COUNT(*) FROM "CorrectiveAction"` | Yes |
| Audit log count | `COUNT(*) FROM "AuditLog"` | Yes |
| Attachment metadata count | `COUNT(*) FROM "InspectionAttachment"` | Yes |
| Truck detail count | `COUNT(*) FROM "TruckInspectionDetail"` | Recommended |

Run via:

```bash
psql "$DATABASE_URL" -f scripts/db/reconcile_counts.sql -o reconcile_after.txt
```

Or the JSON helper used by backup scripts (same queries).

### Pass criteria

For a restore of the **same** dump:

- Every critical count matches the pre-backup snapshot exactly.  
- Optional: checksum of sorted primary-key lists for a sampled table matches.

---

## 2. Critical sample record checks

After restore, pick known business fixture IDs (or natural keys) and verify:

1. **Daily cleaning pass** — status, all item results acceptable, no open CA.  
2. **Daily cleaning fail** — failed items have remarks; CA linked where expected.  
3. **Truck pass** — loading allowed / decision consistent.  
4. **Truck critical fail** — loading blocked flag / status preserved.  
5. **Returned + resubmitted** — status history / approvals still present.  
6. **Supervisor / QA steps** — `checkedById` / `verifiedById` and approval rows intact when used.  
7. **CA lifecycle** — status, assignee, evidence rows.  
8. **Template v1 historical record** after v2 published — `templateVersionId` still points at version 1; current template pointer can be version 2.

Example probe:

```sql
SELECT r.id, r."documentCode", r.status, r."templateVersionId", v."versionNumber", t.code
FROM "InspectionRecord" r
JOIN "ChecklistTemplateVersion" v ON v.id = r."templateVersionId"
JOIN "ChecklistTemplate" t ON t.id = v."templateId"
WHERE t.code = 'NMS/PPU/CL/24'
ORDER BY r."createdAt"
LIMIT 20;
```

---

## 3. Referential integrity spot checks

```sql
-- Orphan results (should be 0)
SELECT COUNT(*) AS orphan_results
FROM "InspectionResult" ir
LEFT JOIN "InspectionRecord" r ON r.id = ir."recordId"
WHERE r.id IS NULL;

-- Records pointing at missing template versions (should be 0)
SELECT COUNT(*) AS broken_template_refs
FROM "InspectionRecord" r
LEFT JOIN "ChecklistTemplateVersion" v ON v.id = r."templateVersionId"
WHERE v.id IS NULL;

-- CAs with resultId that do not exist (should be 0 when resultId IS NOT NULL)
SELECT COUNT(*) AS broken_ca_results
FROM "CorrectiveAction" ca
LEFT JOIN "InspectionResult" ir ON ir.id = ca."resultId"
WHERE ca."resultId" IS NOT NULL AND ir.id IS NULL;
```

---

## 4. Checksum approach (practical)

When tools allow:

```bash
pg_dump -a --inserts -t '"InspectionRecord"' -t '"InspectionResult"' "$DATABASE_URL" \
  | sha256sum
```

Compare pre vs post restore. Prefer `pg_dump -Fc` whole-DB SHA-256 for end-to-end integrity of the dump file itself (see backup runbook).

---

## 5. Recording results

Store:

- Timestamp (Asia/Colombo)  
- Environment name  
- Dump filename + SHA-256  
- Count table (before / after)  
- Pass/fail per metric  
- Operator name  

Use the evidence template in `RESTORE_TEST_EVIDENCE.md`.
