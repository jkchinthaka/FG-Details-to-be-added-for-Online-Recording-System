# Defect Register ? Nelna FG Digital Recording System

**Register opened:** 2026-07-14 (Prompt 22)
**Last reconciled:** 2026-07-14 (Phase 1 current-state audit)
**Rules:** Every defect needs ID, severity, priority, repro, expected/actual, status.
**Severity:** Critical = data loss / unsafe loading / auth bypass of safety controls. High = core workflow unusable or compliance control missing for claimed capability. Medium = partial gap. Low = polish.

**Status vocabulary:** `PRODUCT_FIXED` | `AUTOMATED_TEST_PASSED` | `MANUAL_UAT_PENDING` | `BUSINESS_APPROVAL_PENDING` | `INFRASTRUCTURE_TEST_PENDING` | `OPEN` | `PARTIAL` | `CLOSED`
See `docs/current-state/DOCUMENTATION_RECONCILIATION.md`. Do **not** mark `CLOSED` while plant UAT or infrastructure evidence remains required.

---

## Active and reconciled defects

### DEF-001 ? Supervisor general Return missing

| Field | Value |
|-------|-------|
| Test case | CL24-09, WF-02 |
| Severity | **High** |
| Priority | P1 |
| Closure | **PRODUCT_FIXED** (Prompt 28) ? `POST /inspection-records/:id/return` sets `RETURNED_FOR_CORRECTION` with mandatory comment; operator may resubmit |
| Engineering evidence | **AUTOMATED_TEST_PASSED** ? shared + API workflow policy tests |
| Formal UAT | **MANUAL_UAT_PENDING** (DEF-012) |
| Fix commit | Prompt 28 `feat: complete FG check and verification workflow` |
| Retest | Shared + API workflow policy tests; plant UAT still required |

### DEF-003 ? Checked By / Verified By transitions not implemented

| Field | Value |
|-------|-------|
| Severity | **High** |
| Priority | P1 |
| Closure | **PRODUCT_FIXED** (Prompt 28) ? check/verify APIs + pending queues |
| Engineering evidence | **AUTOMATED_TEST_PASSED** |
| Formal UAT | **MANUAL_UAT_PENDING** |
| Business | **BUSINESS_APPROVAL_PENDING** ? BD-03/04/05/06 |
| Fix commit | Prompt 28 |
| Retest | Unit tests; plant UAT pending |

### DEF-004 ? Self-verification restriction not enforceable

| Field | Value |
|-------|-------|
| Severity | **High** |
| Priority | P1 |
| Closure | **PRODUCT_FIXED** (interim) ? backend SoD defaults refuse creator self-check and checker self-verify |
| Business | **BUSINESS_APPROVAL_PENDING** ? BD-05/06 must APPROVE before treating defaults as Nelna policy |
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
| Actual | **PRODUCT_FIXED (code)** — `GET /inspection-records/reinspection-candidates` + FreezerTruckForm picker; plant retest pending |
| Root cause | UX previously deferred |
| Closure | **READY_FOR_QA** (not CLOSED without plant verification) |

### DEF-005 ? Void / controlled amend process missing

| Field | Value |
|-------|-------|
| Test case | WF-07 |
| Severity | **Medium** |
| Priority | P2 |
| Steps | Attempt void or amend verified record |
| Expected | Controlled process with audit |
| Actual | **PARTIAL** (Prompt 28) ? `POST /:id/void` soft-archives verified/completed with mandatory comment; dedicated amend API still thin |
| Closure | **PARTIAL** |

### DEF-006 — Corrective-action lifecycle UI/API incomplete

| Field | Value |
|-------|-------|
| Test case | CA-02–CA-09 |
| Severity | **High** |
| Priority | P1 |
| Steps | Assign, evidence, complete, close CA from product |
| Expected | Full lifecycle |
| Actual | **PRODUCT_FIXED (code)** — `CorrectiveActionsModule` + `/corrective-actions` list/detail with assign/start/complete/verify/reject/reopen/cancel; plant retest pending |
| Closure | **READY_FOR_QA** (not CLOSED without plant verification) |

### DEF-007 ? Reports / PDF / CSV not delivered

| Field | Value |
|-------|-------|
| Test case | RPT-01?RPT-07 / `UAT_REPORTS_EXPORT.md` |
| Severity | **High** |
| Priority | P1 |
| Steps | Open Reports ? export PDF/CSV |
| Expected | Operational reports + PDF traceability |
| Actual (Prompt 31) | 16 report kinds, CSV formula-safe export, official PDFKit PDF, role-scoped kinds, record PDF download control |
| Closure | **PRODUCT_FIXED** ? not CLOSED (plant evidence incomplete) |
| Formal UAT | **MANUAL_UAT_PENDING** (DEF-012) |
| Business | **BUSINESS_APPROVAL_PENDING** ? BD-25 paper-layout parity |

### DEF-008 ? Admin user & vehicle CRUD missing

| Field | Value |
|-------|-------|
| Test case | ADM-01?ADM-09 / `UAT_ADMIN_MASTER_DATA.md` |
| Severity | **High** |
| Priority | P1 |
| Steps | Admin creates user/vehicle from UI |
| Expected | Manage master data |
| Actual (Prompt 32) | `/admin/users`, `/admin/master-data/*`, `/admin/vehicles`, `/admin/drivers`, `/admin/transporters` APIs + web admin pages. Last-active-admin protection, soft-deactivate, duplicate prevention. |
| Known limits | Users list UI first page only (no paging controls yet); no bulk import; loading-decision-policy content is admin-supplied only |
| Closure | **PRODUCT_FIXED** ? not CLOSED (plant evidence incomplete) |
| Formal UAT | **MANUAL_UAT_PENDING** |

### DEF-009 ? Offline sync / PWA service worker missing

| Field | Value |
|-------|-------|
| Test case | PWA-04?PWA-06 / `UAT_OFFLINE_PWA.md` |
| Severity | **Medium** |
| Priority | P2 |
| Steps | Install PWA ? go offline ? edit ? reconnect ? sync |
| Expected | Queued sync with status and duplicate prevention |
| Actual (Prompt 34) | IndexedDB queue + SW + conflict review + logout cleanup |
| Residual | CA draft online submit limited; IndexedDB not encrypted at rest |
| Closure | **PRODUCT_FIXED** ? not CLOSED (plant evidence incomplete) |
| Formal UAT | **MANUAL_UAT_PENDING** |

### DEF-010 ? Web middleware lacks JWT/role enforcement

| Field | Value |
|-------|-------|
| Test case | AUTH-05 / `UAT_VERIFIED_ROUTE_AUTH.md` |
| Severity | **Medium** |
| Priority | P2 |
| Steps | Operator pastes Admin URL while cookies present |
| Expected | Page-level deny or redirect |
| Actual (Prompt 33) | Middleware verifies `/auth/me` (+ refresh), route ACL, unauthorized/inactive pages, session-expired dialog |
| Residual | Access JWT still valid until TTL after logout; middleware depends on API reachability |
| Closure | **PRODUCT_FIXED** ? not CLOSED (plant evidence incomplete) |
| Formal UAT | **MANUAL_UAT_PENDING** (DEF-012) |

### DEF-011 ? Database restore not proven in this environment

| Field | Value |
|-------|-------|
| Test case | Ops recovery |
| Severity | **High** (ops) |
| Priority | P1 |
| Steps | Backup ? restore ? reconcile counts |
| Expected | Matching counts |
| Actual | Restore **not performed** (Postgres auth / Docker unavailable in evidence window) |
| Evidence | `docs/database/RESTORE_TEST_EVIDENCE.md` |
| Closure | **OPEN** + **INFRASTRUCTURE_TEST_PENDING** |

### DEF-012 ? Formal plant/role UAT not executed

| Field | Value |
|-------|-------|
| Test case | All manual |
| Severity | **High** (release process) |
| Priority | P1 |
| Steps | Execute `UAT_TEST_CASES.md` with required roles on Test env |
| Expected | Pass evidence per case |
| Actual | Documentation + automated Partial only |
| Closure | **OPEN** + **MANUAL_UAT_PENDING** |

---

## Closed defects (`CLOSED` = product + required UAT/ops evidence)

_None._ Product-fixed defects remain open for plant/UAT closure under DEF-012.

---

## Severity summary (Phase 1 reconciled)

| Category | Count | IDs |
|----------|------:|-----|
| Critical open | 0 | - |
| High product READY_FOR_QA (code fixed, plant retest pending) | 2 | DEF-002, DEF-006 |
| High process/ops-open | 2 | DEF-011, DEF-012 |
| Medium partial | 1 | DEF-005 |
| PRODUCT_FIXED awaiting UAT/BD (High/Medium) | 7 | DEF-001, 003, 004, 007, 008, 009, 010 |
| Fully CLOSED | 0 | - |

**Prompt 22 mandate:** "Fix all critical and high-severity defects before release."
**Status:** **Not met** for production — product High DEF-002/006 are READY_FOR_QA (not plant-CLOSED); process/ops High DEF-011/DEF-012 remain open. Authoritative production gate: **NO-GO** (`docs/release/FINAL_GO_LIVE_DECISION.md`). Enterprise readiness this pass: **UAT_READY** (see `docs/FINAL_IMPLEMENTATION_REPORT.md`).

---

## Template for new defects

```
### DEF-XXX - <title>
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
| Closure status | OPEN / PARTIAL / PRODUCT_FIXED / CLOSED (+ UAT/BD/infra flags) |
```

## Formal multi-role UAT (Prompt 38 / Phase evidence)

| Item | Status |
| --- | --- |
| Formal multi-role UAT | **FORMAL UAT NOT EXECUTED** |
| Defect closures from plant UAT | None ? no plant defects filed this window |
| Sign-off | Not signed ? see `UAT_SIGNOFF.md` |

Open High residuals and unsigned formal UAT remain release blockers under the final go-live gate.
