# Current System Audit — Nelna FG Digital Recording System

**Phase:** 1 — Current-state reconciliation  
**Audit date:** 2026-07-14  
**Auditor role:** Principal architect / BA / QA (repository source of truth)  
**Branch:** `develop`  
**Starting SHA:** `9b0543429edad2cb72b9db3a3cacc1e44b9435cd`  
**Remote:** `https://github.com/jkchinthaka/FG-Details-to-be-added-for-Online-Recording-System.git`  
**Production gate (authoritative):** **NO-GO** — `docs/release/FINAL_GO_LIVE_DECISION.md`  
**MVP tag gate (historical):** CONDITIONAL GO / tag `v1.0.0` — `docs/release/GO_LIVE_DECISION.md`

This audit describes what exists in source code and repository documentation. It does **not** invent Nelna policy, fabricate plant UAT results, or claim backup/restore PASS.

---

## 1. Executive verdict

The repository is a **working MVP-plus product baseline** on `develop`, substantially ahead of the `v1.0.0` MVP tag on several fronts (check/verify, reports, admin, offline/PWA, verified route auth, CI). It is **not** production-ready: formal UAT, restore evidence, pilot, and all BD-01–25 approvals remain outstanding. Several enterprise domains required by the master improvement plan are only partial or missing (Corrective Action lifecycle UI/API, truck re-inspection picker UI, controlled amendments, recurring schedules, KPI governance, localization).

| Dimension | Verdict |
|-----------|---------|
| Core inspection workflows (CL/24, CL/30 draft→submit) | Present and automated-test covered |
| Check / Verify / Return | Present in API + web queues (plant UAT pending) |
| Reports / PDF / CSV | Present (plant UAT pending; BD-25 paper parity PENDING) |
| Admin / master data / fleet | Present (plant UAT pending) |
| Offline queue + PWA shell | Present (plant UAT pending; CA offline submit limited) |
| Corrective Action product workspace | **Partial** — schema + auto-create; no CA module/UI lifecycle |
| Truck re-inspection product UX | **Partial** — API/schema linkage; UI picker incomplete |
| Controlled amendment | **Missing** (void partial; amend stubs only) |
| Recurring task scheduling | **Missing** (one-shot `TaskAssignment` only) |
| Formal NonConformity entity | **Not present** — pending QA/business decision |
| Notifications | **Partial** — DB rows on some record events; no inbox API |
| Business policy pack | **0 APPROVED / 25 PENDING** |
| Formal UAT / restore / pilot | **NOT EXECUTED / PLANNED** |
| Production promotion | **NO-GO** |

---

## 2. Architecture snapshot

| Layer | Implementation |
|-------|----------------|
| Monorepo | pnpm workspaces |
| Web | Next.js App Router (`apps/web`), Tailwind, `@nelna/ui`, react-hook-form + Zod |
| API | NestJS REST (`apps/api`), Swagger at `/api/docs` |
| DB | PostgreSQL + Prisma (`apps/api/prisma/schema.prisma`) |
| Shared | `@nelna/shared` types, permissions, checklist engine, workflow, reports |
| Auth | JWT cookies, refresh, lockout, inactive refusal, API RBAC + web middleware `/auth/me` ACL |
| PWA | `manifest.webmanifest`, `public/sw.js`, IndexedDB offline queue |
| CI | `.github/workflows/ci.yml` |
| E2E | `apps/e2e` Playwright (gated; subset of scenarios automated) |
| Integration DB | `docker-compose.test.yml` → `nelna_fg_test` :5433 |

---

## 3. Frontend audit

### 3.1 Routes (`apps/web/src/app`)

| Area | Routes | Assessment |
|------|--------|------------|
| Home / tasks | `/` → `/tasks` | IMPLEMENTED — role dashboard, summary KPIs |
| Auth | `/login`, `/unauthorized`, `/account-inactive` | IMPLEMENTED |
| Cleaning CL/24 | `/records/cleaning`, `/records/cleaning/[id]` | IMPLEMENTED |
| Freezer truck CL/30 | `/records/freezer-truck`, `/records/freezer-truck/[id]` | IMPLEMENTED (re-inspect display only) |
| Check / Verify | `/records/pending-check`, `/records/pending-verification` | IMPLEMENTED |
| Records hub | `/records`, `/records/new` | IMPLEMENTED |
| Corrective actions | `/corrective-actions` | **PLACEHOLDER** only |
| Reports | `/reports` | IMPLEMENTED |
| Admin | `/admin`, users, vehicles, drivers, transporters, master-data, templates preview | IMPLEMENTED |
| Offline | `/offline`, `/offline/conflicts` | IMPLEMENTED |
| Profile / about / status | `/profile`, `/about`, `/system-status` | IMPLEMENTED |
| Dev | `/dev/ui`, `/dev/templates/preview` | Dev aids |

### 3.2 UX / responsive

- Mobile-first shell: bottom nav (`md:hidden`), sidebar from `md:`
- Sticky mobile actions via `@nelna/ui`
- English-only UI; **no i18n framework**
- Operator patterns present: Mark All Acceptable, exception details, sticky submit

### 3.3 PWA / offline

- Service worker shell cache + offline fallback
- IndexedDB queue with conflict review; logout clears queue
- `CORRECTIVE_ACTION_DRAFT` offline type exists but online submit is effectively unavailable (no CA API)

---

## 4. API audit (`apps/api/src`)

| Module | Present | Notes |
|--------|---------|-------|
| `auth` | Yes | Login / refresh / logout / me |
| `health` | Yes | live / ready |
| `inspection-records` | Yes | Drafts, submit, workflow, loading decision, CA auto-create, void |
| `checklist-templates` | Yes | Versioned publish/archive |
| `tasks` | Yes | Today’s tasks |
| `records` | Yes | Recent records |
| `reports` | Yes | Kinds, run, CSV, record PDF |
| `users` | Yes | Admin user lifecycle |
| `master-data` | Yes | Departments, sections, shifts, failure reasons, CA categories, temp profiles, loading policies |
| `vehicles` (+ admin fleet) | Yes | Search + admin CRUD |
| Corrective-actions module | **No** | Permissions exist; no controller |
| Notifications module | **No** | `notifyUser` private helper only |
| Amendments module | **No** | Permission + `ApprovalType.AMEND` stubs |
| Schedulers / cron | **No** | No recurring generation |

DTO validation, RBAC guards, and audit logging are established patterns on delivered controllers.

---

## 5. Database / Prisma audit

**Models present:** User, Role, Permission, UserRole, RolePermission, RefreshToken, Department, Section, Shift, ChecklistTemplate(+Version/Section/Item/Option), InspectionRecord, TaskAssignment, InspectionResult, InspectionAttachment, Transporter, Vehicle, Driver, TruckInspectionDetail, ApprovalRecord, CorrectiveAction, CorrectiveActionEvidence, FailureReason, CorrectiveActionCategory, TemperatureProfile, LoadingDecisionPolicy, Notification, AuditLog.

**Absent (by design until decided):** NonConformity, Schedule/Recurrence, Amendment revision entity, Integration outbox, Product/Batch/Shipment (beyond truck/fleet).

**CA status enum (schema):** `OPEN`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`, `CANCELLED` — does **not** yet include ASSIGNED, PENDING_VERIFICATION, REJECTED, CLOSED, REOPENED, OVERDUE, CANCELLED_WITH_REASON.

**Loading decisions:** `PENDING`, `APPROVED_FOR_LOADING`, `CONDITIONALLY_APPROVED`, `LOADING_BLOCKED`, `REJECTED`.

**Record workflow:** Draft → submit → pending check/verify → return/resubmit/reject/void as implemented in shared `record-workflow`.

---

## 6. Security & observability (summary)

| Control | Status |
|---------|--------|
| Password hashing / lockout / inactive | Present |
| API permission guards | Present on delivered endpoints |
| Web verified session middleware | Present (Prompt 33) |
| Private evidence / upload hardening | Needs Phase 9 review for enterprise depth |
| Correlation IDs / support reference errors | Partial — strengthen in later observability phase |
| Secrets in repo | `.env.example` only; do not commit real `.env` |
| Dependency advisories | Documented; not falsely closed |

---

## 7. Testing & CI

| Layer | Status |
|-------|--------|
| Unit / API specs | Broad coverage under `apps/api` + `packages/shared` |
| PostgreSQL integration | Present, gated (`RUN_DB_INTEGRATION=1`); soft-skip if DB unavailable |
| Playwright E2E | Partial catalog; not all 20 critical flows automated |
| CI workflow | Present |
| Formal multi-role UAT | **NOT EXECUTED** |
| Restore reconciliation evidence | **NOT EXECUTED** |

---

## 8. Documentation landscape

| Pack | Role |
|------|------|
| `docs/release/FINAL_GO_LIVE_DECISION.md` | Authoritative **NO-GO** |
| `docs/release/GO_LIVE_DECISION.md` | Historical CONDITIONAL GO for `v1.0.0` |
| `docs/approvals/*` | BD-01–25 all PENDING |
| `docs/uat/DEFECT_REGISTER.md` | Defect truth; summary table was stale (reconciled in Phase 1) |
| `docs/current-state/CURRENT_MVP_BASELINE.md` | Historical baseline; incomplete-feature table updated via Phase 1 companions |
| This folder | Phase 1 reconciliation artefacts |

---

## 9. Git branch differences (audit window)

| Ref | SHA at audit start |
|-----|--------------------|
| `HEAD` / `origin/develop` | `9b05434` — `release: complete FG production go live gate` |
| `origin/main` | `214fc2b` — older synchronized MVP tip |

`develop` is **ahead of `main`** with Prompts 28–41 product and quality work. Do **not** merge to `main` until a future release gate clears NO-GO conditions.

---

## 10. Binding rules for subsequent phases

1. Improve incrementally; do not rewrite working modules.  
2. Do not invent APPROVED Nelna policy.  
3. Do not fabricate UAT, restore, or pilot results.  
4. Complete one phase at a time; commit and push `develop` before the next.  
5. Prefer configurable infrastructure when BD status is PENDING.

See also: `IMPLEMENTATION_INVENTORY.md`, `DOCUMENTATION_RECONCILIATION.md`, `NEXT_IMPLEMENTATION_PLAN.md`.
