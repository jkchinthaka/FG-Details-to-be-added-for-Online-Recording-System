# Decision Impact Matrix — Nelna FG Digital Recording System

Maps each business decision to product areas. **Status** is from `APPROVED_BUSINESS_DECISIONS.md` (initially all PENDING).

| BD | Topic | Auth / RBAC | Templates / checklist | Records workflow | CA module | Truck / loading | Admin / master data | Reports / PDF | Offline / ops | Allowed before APPROVED |
|----|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---------|
| BD-01 | CL/24 frequency | | ● | ● | | | | ● | | Configurable assignment keys only |
| BD-02 | Who records | ● | | ● | | ● | | | | Use existing roles; no invented role names |
| BD-03 | Checked By role | ● | | ● | | | | | | Permission-configurable Check |
| BD-04 | Verified By role | ● | | ● | | | | | | Permission-configurable Verify |
| BD-05 | Creator self-check | ● | | ● | | | | | | Configurable SoD flag (default refuse unsafe invent) |
| BD-06 | Checker self-verify | ● | | ● | | | | | | Configurable SoD flag |
| BD-07 | Mandatory Correction | | ● | ● | | | | | | Per-item template flags |
| BD-08 | Formal CA required | | ● | ● | ● | | | | | Per-item template flags |
| BD-09 | Photo evidence | | ● | ● | | | | | | Per-item template flags |
| BD-10 | Critical truck items | | ● | | | ● | | | | Template critical flags; Test seed not production mandate |
| BD-11 | Loading authorizers | ● | | | | ● | | | | Existing loading permission |
| BD-12 | Conditional approve | ● | | | | ● | | | | Feature flag / disabled until APPROVED |
| BD-13 | Re-inspection process | | | ● | ● | ● | | | | Link + immutable original pattern |
| BD-14 | Temp recording required | | ● | | | ● | | | | Template field presence |
| BD-15 | Temp limits | | ● | | | ● | | | | **Config only — no hard-coded guesses** |
| BD-16 | Backdating allowed | ● | | ● | | | | | ● | Gate off until APPROVED |
| BD-17 | Backdate max period | | | ● | | | | | ● | Config key only when BD-16 APPROVED |
| BD-18 | Retention years | | | ● | | | | ● | ● | Soft archive only |
| BD-19 | E-approval acceptance | | | ● | | | | ● | | Legal/business; system can snapshot roles |
| BD-20 | Paper fallback | | | ● | | | | | ● | Procedure doc; optional backfill tooling |
| BD-21 | Offline duration | | | | | | | | ● | Local drafts only until APPROVED target |
| BD-22 | Default CA owner | ● | | | ● | | ● | | | Assignment UI; no invented default person |
| BD-23 | CA SLA / escalation | | | | ● | | | ● | | Configurable when values APPROVED |
| BD-24 | ERP vs local masters | | | | | | ● | | | Local until APPROVED integration |
| BD-25 | PDF exact layout | | | | | | | ● | | No PDF build assuming exact match |

● = primary impact area.

## Prompt sequencing note

| Prompt | Depends on (prefer APPROVED; else configurable) |
|--------|--------------------------------------------------|
| 28 Check/Verify/Return | BD-02…BD-06, BD-19 |
| 29 CA lifecycle | BD-08, BD-22, BD-23 |
| 30 Re-inspect / loading | BD-10…BD-15, BD-12, BD-13 |
