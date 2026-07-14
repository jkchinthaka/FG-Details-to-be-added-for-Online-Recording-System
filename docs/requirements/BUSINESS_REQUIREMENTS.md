# Business requirements — Finished Goods & QA paper records

## Purpose

Prove that Nelna FG Digital Recording System covers the supplied paper records for Finished Goods and QA operations without silently omitting fields, approvals or business rules.

## Developer

Chinthaka Jayaweera

## In-scope reference documents

| Code | Title |
| --- | --- |
| `NMS/PPU/CL/24` | Daily Cleaning Verification |
| `NMS/PPU/CL/30` | Inspection of Freezer Truck Before Loading |

A third business document may be supplied later. **No third document content is invented in this audit.** The dynamic checklist architecture (`ChecklistTemplate` → versioned sections/items → `ChecklistRenderer`) can host additional published templates without redesigning the recording engine; extending persistence for non-status item types (DATE/TIME/NUMBER/TEXT/SIGNATURE answers on `InspectionResult`) is the only known generalisation gap for rich future forms.

## Coverage summary (automated)

See `packages/shared/src/requirement-coverage.ts` and `requirement-coverage.test.ts`.

Statuses used:

- **implemented** — field collected/stored/shown in production paths
- **partial** — present but incomplete relative to paper intent or seed policy ambiguity
- **deferred** — schema/UI hooks ready; operational workflow awaits Nelna confirmation
- **na** — explicitly not applicable (none currently)

## Documents

| File | Content |
| --- | --- |
| [FIELD_MAPPING_MATRIX.md](./FIELD_MAPPING_MATRIX.md) | Source field → UI / API / DB / tests |
| [TRACEABILITY_MATRIX.md](./TRACEABILITY_MATRIX.md) | Audit questions → evidence |
| [BUSINESS_RULES.md](./BUSINESS_RULES.md) | Enforced rules vs deferred rules |
| [OPEN_BUSINESS_DECISIONS.md](./OPEN_BUSINESS_DECISIONS.md) | Decisions that must not be invented |

## Non-negotiable integrity properties

1. Document code and published template version are stored on every record.
2. Published checklist versions are immutable via API.
3. Verified records are not physically deleted through application APIs (lifecycle/`ARCHIVED`).
4. Correction and Corrective Action are separate fields and UI labels.
5. Recorded By is the authenticated user relation (never free-typed).
6. Critical freezer-truck failures block loading approval.
7. Re-inspection linkage is supported in the data model (`reinspectionOfId`).
8. Operational date/time uses **Asia/Colombo**.

## Manual UAT cases (where automation cannot fully substitute)

| ID | Case | Expected |
| --- | --- | --- |
| UAT-CL24-01 | Happy-path cleaning: Mark All Acceptable → Submit | Submits; no failure fields shown |
| UAT-CL24-02 | Fail Cold Room with remark + photo | Submit allowed; corrective action entity created when configured |
| UAT-CL30-01 | All Conditions Passed truck | Recommended Approved for Loading |
| UAT-CL30-02 | Critical fail then try Approve | API/UI deny override |
| UAT-CHECK-01 | Checked By / Verified By actions | Deferred — confirm with Nelna before building |
| UAT-TZ-01 | Record created near midnight Colombo | Date/month/time match plant calendar |
