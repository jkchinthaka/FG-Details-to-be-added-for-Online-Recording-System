# Open business decisions — awaiting Nelna confirmation

These items are intentionally **not invented** by engineering. The product records honest deferrals until Nelna Farm confirms policy.

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

## Instructions for product owners

Reply with decisions by ID. Engineering will implement Check/Verify workflows, CA mandates, and PDF layouts only after confirmation — keeping develop free of fabricated policy.
