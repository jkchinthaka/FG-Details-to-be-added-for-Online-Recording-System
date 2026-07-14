# Go-Live Decision — Nelna FG Digital Recording System v1.0.0

**Date:** 2026-07-14  
**Decision maker (documentation gate):** Independent release review on evidence in `docs/release/*` and prior audit/UAT packs  
**Product owner / IT Manager countersignature:** _pending_

---

## Release control (queue correction)

Per [`docs/QUEUE_CONTROLLER.md`](../QUEUE_CONTROLLER.md):

- Prompt 16 = release-candidate preparation on `develop` only (no `main` merge, no `v1.0.0` tag).
- **Only Prompt 25** may approve go-live, merge to `main`, and create/push annotated `v1.0.0`.
- This decision document is the Prompt 25 go-live record. Tag `v1.0.0` was created once at commit `d863abe` — do not recreate duplicate tags.

## Decision

# CONDITIONAL GO

Not **GO** (unconditional production). Not absolute **NO-GO** for tagging an MVP baseline.

---

## Meaning of this decision

| Allowed under CONDITIONAL GO | Not allowed without clearing conditions |
|------------------------------|-----------------------------------------|
| Tag and publish **v1.0.0** documentation + codebase baseline | Unsupervised plant-wide paper replacement |
| Deploy to **Development / Test / UAT** | Soft-launch to all shifts as sole system of record |
| **Controlled pilot** with written waiver of open High defects and paper fallback | Claiming restore, UAT, or pentest success without evidence |
| Merge `develop` → `main` to mark the MVP baseline | Production cutover without IT Manager + Food Safety sign-off |

---

## Evidence supporting CONDITIONAL GO

- Automated tests: **383 passed, 0 failed**  
- Lint, typecheck, production builds: **Pass**  
- Critical defects: **0 open**  
- Auth, CL/24 submit, CL/30 critical loading block: implemented and unit-tested  
- Security / ops / handover documentation present  
- Production env fail-closed + readiness probes available  

## Evidence preventing Unconditional GO

- Open **High** defects: DEF-001–004, DEF-006–008, DEF-011, DEF-012  
- Formal UAT: **not signed**  
- DB restore: **not performed** in this environment  
- Dependency audit findings remain  
- Format check drift remains  

## Mandatory conditions before full production GO

1. Close or formally waive each open High defect with Food Safety / IT Manager signatures.  
2. Execute and sign multi-role UAT (`docs/uat/UAT_SIGNOFF_TEMPLATE.md`).  
3. Perform real backup → restore → reconciliation (`docs/database/RESTORE_TEST_EVIDENCE.md` updated to PASS).  
4. Confirm or implement Check/Verify policy (OBD-05/06) if required for paper equivalence.  
5. Complete production checklist (`docs/operations/PRODUCTION_CHECKLIST.md`) with named authorizers.  
6. Re-run release gate and issue a new decision document if scope expands.

## Production deployment claim

**No production deployment was performed or verified as part of this gate.**

---

**Signed (engineering gate):** Chinthaka Jayaweera — 2026-07-14 — CONDITIONAL GO  
**Signed (IT Manager):** _________________ date _______  
**Signed (QA / Food Safety):** _________________ date _______
