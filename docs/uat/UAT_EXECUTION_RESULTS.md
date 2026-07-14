# UAT Execution Results — Nelna FG Digital Recording System

**Execution window:** 2026-07-14 (Prompt 22 documentation gate)  
**Executor:** Development gate (Chinthaka Jayaweera) + automated suite  
**Environment:** Local Windows workspace; PostgreSQL live UI UAT **not available** (DB auth failure / Docker down)  

**Honesty rule:** Pass only with evidence. Automated test IDs are evidence for mapped behaviours only — they do **not** replace plant role UAT for Food Safety sign-off.

---

## 1. Automated suite evidence (supporting)

| Suite | Result | Notes |
|-------|--------|-------|
| `packages/shared` tests | Pass | Coverage helpers, inspection duplicate rules, etc. |
| `packages/ui` tests | Pass | Design system components |
| `apps/api` Jest | **157 passed** | Auth, inspection submit, templates, tasks, vehicles search, health, constraints soft-skip without Postgres |
| `apps/web` Vitest | **95 passed** | Dashboard, cleaning workspace, freezer truck form, draft storage, auth helpers |
| Playwright / Cypress e2e | **Not present** | No browser e2e pack in repo |

Timestamp: same CI-equivalent run as Prompt 21 verification (re-run before Prompt 22 commit if status changes).

---

## 2. Results matrix

### Authentication

| ID | Result | Evidence | Notes |
|----|--------|----------|-------|
| AUTH-01 | **Partial** | `auth.service.spec.ts`, login DTO tests | Manual browser login Not Executed (no live UAT stack) |
| AUTH-02 | **Partial** | Auth service unit tests | |
| AUTH-03 | **Partial** | Inactive path in `auth.service.spec.ts` | |
| AUTH-04 | **Partial** | Refresh/cookie unit coverage | Session expiry soak Not Executed |
| AUTH-05 | **Partial** | Guards specs (`roles`, `permissions`, `jwt`) | Web middleware is cookie-presence only |
| AUTH-06 | **Partial** | Lockout logic in auth service specs | |

### Daily cleaning

| ID | Result | Evidence | Notes |
|----|--------|----------|-------|
| CL24-01 | **Partial** | `InspectionRecordWorkspace.test.tsx` three-click path; API inspection specs | Live DB submit Not Executed |
| CL24-02 | **Partial** | Workspace validation + API fail/CA specs | |
| CL24-03 | **Partial** | API multi-fail / CA idempotency specs | |
| CL24-04 | **Partial** | Workspace “remark/evidence required” tests | |
| CL24-05 | **Partial** | Draft PATCH + `draft-storage.test.ts` | |
| CL24-06 | **Partial** | Duplicate/resume logic shared + API | |
| CL24-07 | **Partial** | Submit locking specs | |
| CL24-08 | **Partial** | `resolveDraftDuplicate` + API | |
| CL24-09 | **Deferred** | — | No general supervisor Return API (DEF-001) |
| CL24-10 | **Partial** | REJECTED editable + resubmit in service specs | Requires record already REJECTED |

### Truck inspection

| ID | Result | Evidence | Notes |
|----|--------|----------|-------|
| CL30-01 | **Partial** | `FreezerTruckForm.test.tsx`; API truck submit | |
| CL30-02 | **Partial** | API/service | Manual confirm vs plant critical list = OBD-04 |
| CL30-03 | **Partial** | Critical → block logic in API + UI allowed decisions | |
| CL30-04 | **Partial** | Override exception + UI | |
| CL30-05 | **Partial** | CA create on submit specs | |
| CL30-06 | **Blocked** | API field exists | UI re-inspection picker incomplete (DEF-002 / OBD-07) |
| CL30-07 | **Partial** | Loading-decision API specs | Role UAT Not Executed live |
| CL30-08 | **Partial** | Permissions on decision endpoint | |

### Workflow

| ID | Result | Evidence | Notes |
|----|--------|----------|-------|
| WF-01 | **Deferred** | Schema/header only | DEF-003, OBD-05/06 |
| WF-02 | **Deferred** | — | DEF-001 |
| WF-03 | **Deferred** | — | DEF-003 |
| WF-04 | **Deferred** | Truck loading REJECTED only | |
| WF-05 | **Partial** | SUBMITTED lock works; VERIFIED path missing | DEF-003 |
| WF-06 | **Deferred** | — | DEF-004 / OBD-06 |
| WF-07 | **Deferred** | — | DEF-005 |

### Corrective actions

| ID | Result | Evidence | Notes |
|----|--------|----------|-------|
| CA-01 | **Partial** | Submit creates CA | |
| CA-02–CA-09 | **Deferred** | Schema/placeholder page | DEF-006 |

### Reports

| ID | Result | Evidence | Notes |
|----|--------|----------|-------|
| RPT-01–RPT-07 | **Deferred** | Placeholder reports page; ADR-009 | DEF-007 |

### Administration

| ID | Result | Evidence | Notes |
|----|--------|----------|-------|
| ADM-01–ADM-05 | **Deferred** | No users/vehicles CRUD UI/API for manage | DEF-008 |
| ADM-06–ADM-09 | **Partial** | `checklist-templates.service.spec.ts` publish/archive immutability | Admin authoring UI thin (preview only) |

### PWA

| ID | Result | Evidence | Notes |
|----|--------|----------|-------|
| PWA-01 | **Partial** | `manifest.webmanifest` present | Device install Not Executed |
| PWA-02 | **Partial** | localStorage draft tests | |
| PWA-03 | **Not Executed** | — | Needs device |
| PWA-04–PWA-06 | **Deferred** | No service worker sync | DEF-009 / TD-12 |

### Accessibility & responsive

| ID | Result | Evidence | Notes |
|----|--------|----------|-------|
| A11Y-01–A11Y-04 | **Not Executed** | Component tests use jsdom | Need real device/browser matrix |
| A11Y-05–A11Y-09 | **Not Executed** | Design system focus styles exist in UI package | Formal a11y audit outstanding |

---

## 3. Summary counts (this gate)

| Status | Count (approx.) |
|--------|----------------:|
| Pass (manual plant evidence) | **0** |
| Partial (automated only) | **~35** |
| Deferred / Blocked | **~40** |
| Not Executed (manual/device) | **~12** |
| Fail (new regression) | **0** found in automated suite |

---

## 4. Conclusion for Prompt 22

**Formal multi-role UAT on a shared Test environment was not executed** in this session. Automated regression is green. Product gaps required by the UAT catalogue are logged as defects (see `DEFECT_REGISTER.md`). Critical/high process gaps remain **open** → release readiness cannot be Unconditional Go (see scorecard).

Stakeholder plant UAT using this case list remains mandatory before Food Safety acceptance.
