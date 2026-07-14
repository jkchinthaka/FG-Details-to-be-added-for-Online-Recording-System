# Open business decisions — awaiting Nelna confirmation

These items are intentionally **not invented** by engineering. The product records honest deferrals until Nelna Farm confirms policy.

## A. Traceability / form-policy decisions (OBD-01–10)

| ID | Decision needed | Current system behaviour | Risk if guessed |
| --- | --- | --- | --- |
| OBD-01 | Is **Month** only a derived display from Date, or a separately auditable paper field? | Derived `recordMonth` shown; not stored | Wrong audit interpretation |
| OBD-02 | Must **Correction** be mandatory on every Unacceptable/Fail? | Optional | Under/over-collection of evidence |
| OBD-03 | Must **Corrective Action** be mandatory on every failure (vs critical-only)? | Seed requires CA on configured critical items | Conflicts with docs/records.md wording vs seed |
| OBD-04 | Exact truck checklist criticality list | Seed marks several operational checks critical beyond headline paper list | False blocks or unsafe approvals |
| OBD-05 | Relationship between **Checked By**, **Verified By**, and **Final Loading Decision** on CL/30 | Loading decision uses `decidedBy`; Check/Verify deferred | Wrong accountability chain |
| OBD-06 | Who may Check / Verify; can creators self-check? | Not implemented | Security/workflow defect |
| OBD-07 | Re-inspection trigger UX after blocked/rejected truck | API linkage exists; full UI picker incomplete | Lost traceability in plant practice |
| OBD-08 | Plant shift clock boundaries in Asia/Colombo | MORNING <14, AFTERNOON <22, else NIGHT (Colombo hour) | Wrong shift assignment |
| OBD-09 | Retention / archive period for verified records | Soft lifecycle only | Compliance gap |
| OBD-10 | PDF/print field order vs paper originals | PDF deferred | Report rejection during audits |

## B. Operating-policy decisions (must be confirmed — do not invent)

| ID | Decision needed | Current / interim behaviour | Risk if guessed |
| --- | --- | --- | --- |
| OBD-11 | **Shift-wise versus daily** record frequency for each form (CL/24, CL/30, future codes) | Task assignments keyed by user/template/**dueDate**; shift optional on records | Over/under production of required records |
| OBD-12 | **Backdated record** rules (allowed window, who may backdate, audit requirements) | Record date is set by create/draft APIs; no formal backdate policy gate | Compliance / fraud exposure |
| OBD-13 | **Photo evidence** requirements (which fails, mandatory vs optional, retention of binaries) | Seed `requiresEvidenceOnFail` on configured items; attachment MIME/size capped | Insufficient or excessive evidence burden |
| OBD-14 | **Truck temperature** requirements (limits, measuring points, fail thresholds) | Checklist-driven if present on template version; no invented numeric plant limit in code | Unsafe load or false fails |
| OBD-15 | **Electronic approval acceptance** vs wet-ink / dual control for Food Safety | Cookie auth + role permissions; Check/Verify deferred | Regulatory rejection |
| OBD-16 | **Data-retention period** and legal hold (overlaps OBD-09; confirm numeric years + disposal) | Soft archive fields only; no automated purge | Legal/compliance gap |
| OBD-17 | **Corrective-action ownership** (default assignee role, SLA, escalation) | Auto-create CA rows on configured fails; assignment/closure UI deferred | Actions stall without owner |
| OBD-18 | **Final loading authorization** (roles, override rules, relationship to Check/Verify) | Loading decision permission-gated; critical block prevents unsafe approve | Unsafe override or deadlock |
| OBD-19 | **ERP / employee-master integration** (authoritative source for users, vehicles, drivers) | Seed + local tables; no ERP sync | Duplicate/divergent master data |
| OBD-20 | **Offline operating requirements** (must-work offline duration, sync rules, paper fallback) | Manifest + localStorage drafts; no service-worker sync | Shop-floor failure mode unclear |

## Instructions for product owners

Reply with decisions by ID. Engineering will implement Check/Verify workflows, CA mandates, PDF layouts, retention jobs, and offline sync only after confirmation — keeping `develop` free of fabricated Nelna policy.

Related: [`docs/QUEUE_CONTROLLER.md`](../QUEUE_CONTROLLER.md) §5.
