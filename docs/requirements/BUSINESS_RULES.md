# Business rules — enforced vs deferred

## Enforced in code (automated tests exist)

1. **Exception-based recording** — Mark All Acceptable fills only unanswered eligible items; does not overwrite manual failures.
2. **Failure progressive disclosure** — Failure detail panel appears only after Fail/Unacceptable.
3. **Remark / evidence on fail** — Driven by checklist item rules (`remarkRequiredOnFail`, `photoRequiredOnFail`).
4. **Submission locking** — After SUBMITTED/CHECKED/VERIFIED, operator cannot edit (REJECTED may resume correction workflow).
5. **Duplicate active draft prevention** — Same date/shift/area (cleaning) or equivalent truck draft resolution.
6. **Document + version stamp** — Every record references a published template version.
7. **Published template immutability** — API rejects mutating published versions.
8. **Critical loading block** — Critical truck failures compute `LOADING_BLOCKED`; approval cannot override to approved.
9. **Role-gated loading decision** — Supervisor / QA / Food Safety / Admin only.
10. **Audit of loading decisions** — `AuditLog` (+ approval record) on final decision.
11. **Asia/Colombo operational calendar** — Date-of-record and truck inspection time.
12. **Correction vs Corrective Action** — Distinct storage and UI.

## Deferred (must not be invented)

1. **Checked By / Verified By operational transitions** — Who may check/verify, self-check prohibition, SLA — schema ready only.
2. **Mandatory Correction on every failure** — Currently optional quick-choice.
3. **Mandatory Corrective Action on every failure** — Seed configures critical items only.
4. **Whether Final Loading Decision replaces or sits beside Check/Verify** for CL/30.
5. **PDF/report layout parity** with paper forms.
6. **Authoritative plant shift cutovers** if different from current MORNING/AFTERNOON/NIGHT hours.
7. **Exact critical-item list** for trucks if Nelna’s paper criticality differs from seed extras (Door, Sealing, Freezer Unit, Bad Smell, Contamination Evidence).

## Soft-delete / archive policy

- Application rejects physical deletion of quality records.
- `ARCHIVED` status and `archivedAt` support lifecycle retention.
- Database-level delete prevention (triggers/RLS) is a future hardening item — do not claim it exists today.
