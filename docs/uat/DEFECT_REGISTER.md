# Defect Register — Nelna FG Digital Recording System

**Register opened:** 2026-07-14 (Prompt 22)  
**Rules:** Every defect needs ID, severity, priority, repro, expected/actual, status.  
**Severity:** Critical = data loss / unsafe loading / auth bypass of safety controls. High = core workflow unusable or compliance control missing for claimed capability. Medium = partial gap. Low = polish.

---

## Active defects

### DEF-001 — Supervisor general Return (set REJECTED) missing

| Field | Value |
|-------|-------|
| Test case | CL24-09, WF-02 |
| Severity | **High** |
| Priority | P1 |
| Closure | **Fixed (Prompt 28)** — `POST /inspection-records/:id/return` sets `RETURNED_FOR_CORRECTION` with mandatory comment; operator may resubmit |
| Fix commit | Prompt 28 `feat: complete FG check and verification workflow` |
| Retest | Shared + API workflow policy tests; manual UAT still required |

### DEF-003 — Checked By / Verified By transitions not implemented

| Field | Value |
|-------|-------|
| Closure | **Fixed (Prompt 28)** — check/verify APIs + pending queues; SoD defaults pending BD-05/06 APPROVED |
| Fix commit | Prompt 28 |
| Retest | Unit tests; plant UAT pending |

### DEF-004 — Self-verification restriction not enforceable

| Field | Value |
|-------|-------|
| Closure | **Fixed (interim)** — backend SoD defaults refuse creator self-check and checker self-verify until BD-05/06 APPROVED otherwise |
| Fix commit | Prompt 28 |
| Retest | `record-workflow` / policy specs |

### DEF-002 — Truck re-inspection UI picker incomplete

| Field | Value |
|-------|-------|
| Test case | CL30-06 |
| Severity | **High** |
| Priority | P1 |
| Steps | After critical block, start re-inspection of prior truck record from UI |
| Expected | Operator selects prior record; `reinspectionOfId` set; history visible |
| Actual | API/schema support; UI picker incomplete (OBD-07 / BD-13) |
| Root cause | UX deferred to Prompt 30 |
| Closure | **Open** |

### DEF-005 — Void / controlled amend process missing

| Field | Value |
|-------|-------|
| Test case | WF-07 |
| Severity | **Medium** |
| Priority | P2 |
| Steps | Attempt void or amend verified record |
| Expected | Controlled process with audit |
| Actual | **Partial (Prompt 28)** — `POST /:id/void` soft-archives verified/completed with mandatory comment; dedicated amend API still thin |
| Closure | **Partial** |

### DEF-006 — Corrective-action lifecycle UI/API incomplete

| Field | Value |
|-------|-------|
| Test case | CA-02–CA-09 |
| Severity | **High** |
| Priority | P1 |
| Steps | Assign, evidence, complete, close CA from product |
| Expected | Full lifecycle |
| Actual | Auto-create on submit only; placeholder `/corrective-actions` page; no CA controller |
| Closure | **Open** |

### DEF-007 — Reports / PDF / CSV not delivered

| Field | Value |
|-------|-------|
| Test case | RPT-01–RPT-07 / `UAT_REPORTS_EXPORT.md` |
| Severity | **High** |
| Priority | P1 |
| Steps | Open Reports → export PDF/CSV |
| Expected | Operational reports + PDF traceability |
| Actual (Prompt 31) | 16 report kinds, CSV formula-safe export, official PDFKit PDF, role-scoped kinds, record PDF download control |
| Closure | **Closed (product)** — Plant UAT still unsigned (DEF-012); BD-25 paper-layout parity still PENDING |

### DEF-008 — Admin user & vehicle CRUD missing

| Field | Value |
|-------|-------|
| Test case | ADM-01–ADM-09 / `UAT_ADMIN_MASTER_DATA.md` |
| Severity | **High** |
| Priority | P1 |
| Steps | Admin creates user/vehicle from UI |
| Expected | Manage master data |
| Actual (Prompt 32) | `/admin/users`, `/admin/master-data/*` (departments, sections, shifts, failure reasons, corrective action categories, temperature profiles, priorities, loading-decision-policies), `/admin/vehicles`, `/admin/drivers`, `/admin/transporters` APIs + minimal web admin pages under `/admin/*`. Last-active-admin protection, role/audit logging, soft-deactivate only (no hard delete), duplicate prevention on vehicle/driver/transporter creation. |
| Known limits | Users list UI shows only the first page (no paging controls yet); no bulk import; loading-decision-policy content is admin-supplied only, never invented by the system |
| Closure | **Closed (product)** — Plant UAT still to be executed against `UAT_ADMIN_MASTER_DATA.md` |

### DEF-009 — Offline sync / PWA service worker missing

| Field | Value |
|-------|-------|
| Test case | PWA-04–PWA-06 / `UAT_OFFLINE_PWA.md` |
| Severity | **Medium** |
| Priority | P2 |
| Steps | Install PWA → go offline → edit → reconnect → sync |
| Expected | Queued sync with status and duplicate prevention |
| Actual (Prompt 34) | IndexedDB queue + SW + conflict review + logout cleanup |
| Residual | CA draft online submit limited; IndexedDB not encrypted at rest |
| Closure | **Closed (product)** — plant network UAT unsigned |

### DEF-010 — Web middleware lacks JWT/role enforcement

| Field | Value |
|-------|-------|
| Test case | AUTH-05 / `UAT_VERIFIED_ROUTE_AUTH.md` |
| Severity | **Medium** |
| Priority | P2 |
| Steps | Operator pastes Admin URL while cookies present |
| Expected | Page-level deny or redirect |
| Actual (Prompt 33) | Middleware verifies `/auth/me` (+ refresh), route ACL, unauthorized/inactive pages, session-expired dialog |
| Residual | Access JWT still valid until TTL after logout (known SEC note); middleware depends on API reachability |
| Closure | **Closed (product)** — plant UAT unsigned (DEF-012) |

### DEF-011 — Database restore not proven in this environment

| Field | Value |
|-------|-------|
| Test case | Ops recovery (Prompt 21) |
| Severity | **High** (ops) |
| Priority | P1 |
| Steps | Backup → restore → reconcile counts |
| Expected | Matching counts |
| Actual | Restore **not performed** (Postgres auth / Docker unavailable) |
| Evidence | `docs/database/RESTORE_TEST_EVIDENCE.md` |
| Closure | **Open** |

### DEF-012 — Formal plant/role UAT not executed

| Field | Value |
|-------|-------|
| Test case | All manual |
| Severity | **High** (release process) |
| Priority | P1 |
| Steps | Execute `UAT_TEST_CASES.md` with six roles on Test env |
| Expected | Pass evidence per case |
| Actual | Documentation + automated Partial only |
| Closure | **Open** |

---

## Closed defects

_None closed in Prompt 22._ Automated suite found **no new failing regressions** to fix as code defects. Product completeness gaps remain open above.

---

## Severity summary

| Severity | Open | Closed |
|----------|-----:|-------:|
| Critical | 0 | 0 |
| High | 9 | 0 |
| Medium | 3 | 0 |
| Low | 0 | 0 |

**Prompt 22 mandate:** “Fix all critical and high-severity defects before release.”  
**Status:** **Not met** — High defects remain open; several blocked on Nelna OBDs. Release gate must be **NO-GO** or **CONDITIONAL GO** with explicit waivers — not Unconditional GO.

---

## Template for new defects

```
### DEF-XXX — <title>
| Field | Value |
| Test case | |
| Severity | |
| Priority | |
| Steps to reproduce | |
| Expected result | |
| Actual result | |
| Screenshot or log reference | |
| Root cause | |
| Fix commit | |
| Retest result | |
| Closure status | Open / Fixed / Won't fix / Deferred |
```

## Prompt 38 � Formal multi-role UAT

| Item | Status |
| --- | --- |
| Formal multi-role UAT | **FORMAL UAT NOT EXECUTED** |
| Defect closures from plant UAT | None � no plant defects filed this window |
| Sign-off | Not signed � see `UAT_SIGNOFF.md` |

Open High residuals and unsigned formal UAT remain release blockers under Prompt 41 rules.
