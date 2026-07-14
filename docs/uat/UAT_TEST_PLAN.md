# UAT Test Plan — Nelna FG Digital Recording System

**Document ID:** UAT-PLAN-MVP-1.0  
**System:** Nelna FG Digital Recording System  
**Branch baseline:** `develop` @ `8689f47` (post Prompt 21)  
**Prepared:** 2026-07-14  
**Prepared by:** Chinthaka Jayaweera  

---

## 1. Objectives

Execute a rigorous User Acceptance Testing cycle using realistic Nelna Finished Goods / QA scenarios so that:

1. Business stakeholders can accept or reject release readiness with evidence.  
2. Critical and high-severity defects are recorded, fixed where in-scope, and retested.  
3. Deferred product gaps (pending Nelna OBDs) are explicitly **not** marked as Passed.

This plan does **not** invent Check/Verify policy, CA-on-every-fail rules, or PDF layouts (see `docs/requirements/OPEN_BUSINESS_DECISIONS.md`).

---

## 2. Scope

### In scope (MVP behaviours present in product)

- Authentication (login, inactive, lockout, cookie session, API RBAC)  
- Daily cleaning digital record (NMS/PPU/CL/24) draft → submit, fail + evidence, duplicate draft rules  
- Freezer truck pre-loading inspection (NMS/PPU/CL/30) including critical loading block and loading decision  
- Template version publish/archive API behaviour (admin API)  
- Soft archive philosophy / no hard delete of quality history via product APIs  
- PWA install metadata + local draft backup (not full offline sync)  
- Responsive shell and keyboard-accessible form controls where implemented  
- Automated regression suite as supporting evidence  

### Out of scope / deferred (must not be marked Passed)

- Supervisor **Check** / QA **Verify** transition APIs and UI actions (schema + display only)  
- General record **Return** that sets `REJECTED` (except truck loading decision `REJECTED`)  
- Void / amend of verified records  
- Corrective-action assignment, evidence upload, closure **workspace**  
- Reports, PDF, CSV export  
- User/vehicle master-data CRUD admin UIs  
- Service-worker offline sync queue  
- Production deployment / live plant devices  

### Environments

| Environment | Use |
|-------------|-----|
| Local developer | Automated tests; limited manual smoke if API + DB up |
| Test / UAT | Primary manual UAT (when Nelna provides hosts + seeded users) |
| Production | **Not** used for UAT |

---

## 3. Roles under test

| UAT role | Maps to system role(s) | Primary scenarios |
|----------|------------------------|-------------------|
| FG Operator | Operator | Cleaning, truck draft/submit, evidence |
| FG Supervisor | Supervisor | Loading decision; (future) Check / Return |
| QA Executive | QA | Loading approve; (future) Verify |
| Food Safety Team Leader | Food Safety / equivalent seeded role | Oversight, CA view (future) |
| System Administrator | Admin | Templates API, user lifecycle (future UI) |
| Auditor | Auditor (read) | Audit trail review, report access (future) |

Seeded credentials must come from environment-controlled seed vars — never from docs.

---

## 4. Entry criteria

- [x] `develop` clean and pushed  
- [x] Lint / typecheck / unit+integration tests green on baseline  
- [x] Migration runbook and backup procedure documented  
- [ ] Reachable UAT PostgreSQL with `migrate deploy` + seed (optional for doc-only baseline; required for plant sign-off)  
- [ ] Stakeholders available for role-based execution  

---

## 5. Exit criteria

| Criterion | Requirement |
|-----------|-------------|
| Critical defects | Zero open |
| High defects | Zero open **or** explicitly accepted as CONDITIONAL with written waiver |
| Medium/Low | Logged with target release |
| Evidence | Every Passed case references log, screenshot ID, or automated test ID |
| Deferred cases | Marked `BLOCKED` / `DEFERRED` with OBD or defect ID — never Passed |

---

## 6. Execution method

1. **Automated evidence first** — map cases to Jest/Vitest where behaviour is covered.  
2. **Manual execution** on Test/UAT — operator walks checklist with screenshots in secure store.  
3. **Defect logging** in `DEFECT_REGISTER.md` using DEF-### IDs.  
4. **Retest** after fix commits; update `UAT_EXECUTION_RESULTS.md`.  

This Prompt 22 pack records: full case catalogue, honest current execution status, known product defects/gaps, and a release readiness scorecard. Full plant-floor UAT remains required before Food Safety sign-off.

---

## 7. Deliverables

| Document | Purpose |
|----------|---------|
| `UAT_TEST_PLAN.md` | This plan |
| `UAT_TEST_CASES.md` | Detailed cases |
| `UAT_EXECUTION_RESULTS.md` | Results + evidence refs |
| `DEFECT_REGISTER.md` | Defect lifecycle |
| `UAT_SIGNOFF_TEMPLATE.md` | Formal acceptance signatures |
| `RELEASE_READINESS_SCORECARD.md` | Weighted readiness view |

---

## 8. Risks

| Risk | Mitigation |
|------|------------|
| No live UAT DB in agent environment | Mark manual cases Not Executed; do not fake Pass |
| OBD gaps block workflow cases | Defer with OBD IDs; CONDITIONAL readiness |
| Stakeholder unavailable | Scorecard holds “awaiting sign-off” |

---

*UAT Plan · Nelna FG Digital Recording System*
