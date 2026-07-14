# Executive Overview — Nelna FG Digital Recording System

**Audience:** IT Manager, QA Manager, Food Safety leadership  
**Prepared by:** Chinthaka Jayaweera  
**Date:** 2026-07-14  

---

## Current business problem

Finished Goods daily cleaning verification (`NMS/PPU/CL/24`) and freezer truck pre-loading inspection (`NMS/PPU/CL/30`) are still largely paper-based. Paper slows operators, delays QA review, and weakens searchability of historical quality evidence.

## Existing paper-process risks

- Incomplete or illegible records  
- Weak linkage between failures and corrective action  
- Difficult audit trail reconstruction  
- Slow escalation when a freezer truck should not be loaded  
- Template revisions hard to correlate with historical submissions  

## Proposed digital workflow

**Exception-based recording:** Open assigned task → Mark All Acceptable → Change only failed items (remark / evidence) → Submit.

Target operator effort for a normal pass day: roughly **3–5 actions** on a phone.

## User roles

FG Operator, FG Supervisor, QA Executive, Food Safety leadership, System Administrator, Auditor — see `docs/roles.md` and seeded RBAC permissions.

## Business value

- Faster shop-floor completion  
- Structured fail evidence  
- Automatic critical **loading block** on configured truck failures  
- Template **version** binding so history survives form revisions  
- Role-restricted APIs and audited decisions  

## Time-saving workflow

Today’s Tasks dashboard routes the operator to the right digital form for the shift/day instead of hunting paper pads.

## Exception-based recording

Acceptable defaults reduce taps; only nonconformances require remarks and photos where configured.

## Record traceability

Each `InspectionRecord` binds to an exact `ChecklistTemplateVersion`, preserves recorder identity, and supports re-inspection linkage for trucks.

## Approval controls

Submitted records lock from further operator edit. Truck **final loading decision** is permission-gated. Full Checked By / Verified By transitions await Nelna policy confirmation (`OPEN_BUSINESS_DECISIONS.md`).

## Corrective-action tracking

Configured critical failures auto-create corrective-action rows on submit. Full assignment/closure workspace is a known gap (see UAT defects).

## Reporting

Operational report/PDF/CSV surfaces are deferred (ADR-009). Data remains queryable in PostgreSQL for interim reporting.

## Security controls

JWT cookies, lockout, RBAC guards, production secret enforcement, security headers, evidence type/size limits — see `docs/security/`.

## Backup and recovery

Runbooks and scripts exist (`docs/database/`). A live restore test was **not** completed in the development gate; prove restore before production reliance.

## Known limitations

Summarised in UAT scorecard and (after Prompt 25) `docs/release/KNOWN_LIMITATIONS.md`: Check/Verify workflow, CA workspace, reports/PDF, admin CRUD UIs, full offline sync, unsigned plant UAT, unproven DB restore.

## Future expansion

See `FUTURE_ROADMAP.md` — workflow completion, CA app, reports, admin console, offline sync, deeper analytics.
