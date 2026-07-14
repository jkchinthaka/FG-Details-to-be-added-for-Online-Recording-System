# Release Readiness Scorecard — Nelna FG Digital Recording System

**Assessed:** 2026-07-14  
**Assessor:** Prompt 22 UAT documentation gate  
**Commit baseline:** post Prompt 21 `8689f47` (update after this commit)

Scoring: 0 = missing / fail, 1 = partial / deferred with waiver path, 2 = evidenced ready.  
**Weighted readiness** = sum(score × weight) / max possible.

---

## Scorecard

| Area | Weight | Score (0–2) | Rationale |
|------|-------:|------------:|-----------|
| Authentication & RBAC (API) | 5 | 2 | Login, lockout, inactive, guards covered by tests |
| Web route defence-in-depth | 2 | 1 | Cookie gate only (DEF-010) |
| Daily cleaning submit path | 5 | 2 | API+UI+tests; live plant UAT pending |
| Truck inspect + loading block | 5 | 2 | Critical block + decision covered by tests |
| Check / Verify workflow | 5 | 0 | DEF-003; OBD blocked |
| Return / reject correction cycle | 3 | 0 | DEF-001 |
| Corrective action lifecycle | 4 | 1 | Auto-create only (DEF-006) |
| Reports / PDF / export | 4 | 0 | DEF-007 |
| Admin master data | 3 | 0 | DEF-008 |
| Template versioning API | 3 | 2 | Publish/immutability tested |
| PWA offline sync | 2 | 1 | Manifest + local drafts; no SW (DEF-009) |
| Accessibility formal pass | 2 | 0 | Not Executed |
| Automated regression | 4 | 2 | Shared/UI/API/Web green |
| Database migrate + restore proven | 4 | 1 | Schema OK; restore Not Performed (DEF-011) |
| Formal multi-role UAT signed | 5 | 0 | DEF-012 |
| Security review docs | 3 | 2 | Prompt 19 pack present |
| Ops/backup runbooks | 3 | 1 | Docs exist; restore unproven |

**Weighted total:** 47 / 116 ≈ **40%**

---

## Recommendation

| Decision | Criteria | This gate |
|----------|----------|-----------|
| **GO** | No open Critical/High; signed UAT; restore proven | **No** |
| **CONDITIONAL GO** | High gaps waived in writing; MVP limited to submitted records + loading block; plant UAT scheduled | **Possible only with executive waiver** listing DEF-001–008, 011, 012 |
| **NO-GO** | Open High defects without waiver | **Default recommendation** |

### Default recommendation: **NO-GO for full production**

Rationale: High-severity workflow, CA, reporting, and admin gaps remain open; formal UAT unsigned; DB restore unproven.

### Limited pilot (optional waiver language)

If Nelna accepts a **pilot** limited to:

- Operator draft/submit cleaning & truck  
- Critical loading block + authorized loading decision  
- Template API managed by developer/SQL seed  

…then a **CONDITIONAL GO for pilot only** may be considered after signing `UAT_SIGNOFF_TEMPLATE.md` §4 conditions and scheduling fixes for DEF-003/006/007 before full plant roll-out.

---

## Next actions

1. Provision Test DB; prove restore (close DEF-011).  
2. Confirm OBDs; implement Check/Verify + Return.  
3. CA workspace + reports MVP.  
4. Execute signed multi-role UAT (close DEF-012).  
5. Re-score this card before Prompt 25 Go-Live Decision.

---

*Scorecard · honest assessment · do not inflate scores without evidence*
