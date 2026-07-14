# Implementation Inventory — Nelna FG Digital Recording System

**Phase:** 1 — Current-state reconciliation  
**As of:** 2026-07-14  
**Branch / SHA:** `develop` / `9b0543429edad2cb72b9db3a3cacc1e44b9435cd`

## Status legend

| Status | Meaning |
|--------|---------|
| `IMPLEMENTED_AND_VERIFIED` | Delivered and covered by automated tests executed in CI/local gates; **not** a claim of plant UAT pass |
| `IMPLEMENTED_NOT_UAT_VERIFIED` | Delivered in product; formal multi-role / plant UAT still outstanding |
| `PARTIALLY_IMPLEMENTED` | Meaningful code exists; required lifecycle or UX incomplete |
| `BLOCKED_BY_BUSINESS_DECISION` | Further product behaviour needs APPROVED BD |
| `PLANNED` | Specified in master plan; not started as a deliverable |
| `NOT_APPLICABLE` | Explicitly out of scope until a decision or external dependency |

> **Note:** Nothing below is `IMPLEMENTED_AND_VERIFIED` for *plant* acceptance. The “AND_VERIFIED” label means **automated / engineering verification only**.

---

## A. Platform foundation

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| pnpm monorepo | `IMPLEMENTED_AND_VERIFIED` | Workspace scripts, packages |
| Next.js web app | `IMPLEMENTED_AND_VERIFIED` | `apps/web` |
| NestJS API | `IMPLEMENTED_AND_VERIFIED` | `apps/api` |
| PostgreSQL + Prisma | `IMPLEMENTED_AND_VERIFIED` | Schema + migrations |
| Shared domain package | `IMPLEMENTED_AND_VERIFIED` | `@nelna/shared` |
| UI design system | `IMPLEMENTED_AND_VERIFIED` | `@nelna/ui` |
| Health endpoints | `IMPLEMENTED_AND_VERIFIED` | `/health`, live, ready |
| CI GitHub Actions | `IMPLEMENTED_AND_VERIFIED` | `.github/workflows/ci.yml` |
| Production env fail-closed validation | `PARTIALLY_IMPLEMENTED` | Config helpers; Phase 2 policy gate still needed |
| Secret / `.env` hygiene | `IMPLEMENTED_AND_VERIFIED` | Examples only; real `.env` not committed |

---

## B. Authentication and authorization

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Login / refresh / logout | `IMPLEMENTED_NOT_UAT_VERIFIED` | JWT cookies |
| Account lockout / inactive refuse | `IMPLEMENTED_NOT_UAT_VERIFIED` | Auth module |
| Role + permission RBAC (API) | `IMPLEMENTED_NOT_UAT_VERIFIED` | Guards + seed map |
| Verified web route ACL | `IMPLEMENTED_NOT_UAT_VERIFIED` | Middleware + `/auth/me` (DEF-010 product closed) |
| Record-level authorization depth | `PARTIALLY_IMPLEMENTED` | Enforced on delivered actions; expand with CA/amend |
| CSRF / CORS / security headers | `PARTIALLY_IMPLEMENTED` | Baseline present; residual review in security phases |
| Electronic approval legal acceptance | `BLOCKED_BY_BUSINESS_DECISION` | BD-19 PENDING |

---

## C. Checklist engine and templates

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Versioned templates | `IMPLEMENTED_AND_VERIFIED` | Publish / archive immutability |
| CL/24 Daily Cleaning | `IMPLEMENTED_NOT_UAT_VERIFIED` | Template + forms |
| CL/30 Freezer Truck | `IMPLEMENTED_NOT_UAT_VERIFIED` | Template + forms |
| Mark All Acceptable / exception UX | `IMPLEMENTED_NOT_UAT_VERIFIED` | `@nelna/ui` checklist |
| Evidence upload on fail rules | `IMPLEMENTED_NOT_UAT_VERIFIED` | Attachments model + UI |
| Template admin clone/preview | `IMPLEMENTED_NOT_UAT_VERIFIED` | Admin + preview routes |
| Paper layout PDF parity | `BLOCKED_BY_BUSINESS_DECISION` | BD-25 PENDING |

---

## D. Task assignment and scheduling

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Today’s Tasks dashboard | `IMPLEMENTED_NOT_UAT_VERIFIED` | `/tasks`, `GET /tasks/today` |
| One-shot TaskAssignment seed | `IMPLEMENTED_AND_VERIFIED` | Seed builds today’s assignments |
| Recurring schedules (daily/weekly/…) | `PLANNED` | No Schedule model / cron |
| Shift handover / missed-task report | `PLANNED` | — |
| Event-triggered generation | `PLANNED` | — |
| Record frequency policy | `BLOCKED_BY_BUSINESS_DECISION` | BD-01 PENDING |

---

## E. Inspection record workflow

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Draft create / update | `IMPLEMENTED_NOT_UAT_VERIFIED` | Cleaning + truck |
| Submit | `IMPLEMENTED_NOT_UAT_VERIFIED` | — |
| Check (Checked By) | `IMPLEMENTED_NOT_UAT_VERIFIED` | DEF-003 PRODUCT_FIXED; UAT pending |
| Verify (Verified By) | `IMPLEMENTED_NOT_UAT_VERIFIED` | DEF-003 PRODUCT_FIXED; UAT pending |
| Return for correction + resubmit | `IMPLEMENTED_NOT_UAT_VERIFIED` | DEF-001 PRODUCT_FIXED; UAT pending |
| Reject / void (soft archive) | `PARTIALLY_IMPLEMENTED` | Void API; amend incomplete (DEF-005) |
| Segregation of duties defaults | `PARTIALLY_IMPLEMENTED` | Interim until BD-05/06 APPROVED (DEF-004) |
| Verified-record immutability | `PARTIALLY_IMPLEMENTED` | Locked in workflow; controlled amend missing |
| Audit log of workflow decisions | `IMPLEMENTED_NOT_UAT_VERIFIED` | AuditLog usage on key paths |
| Checker / verifier role policy | `BLOCKED_BY_BUSINESS_DECISION` | BD-03/04/05/06 PENDING |

---

## F. Truck loading and re-inspection

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Critical fail → loading block | `IMPLEMENTED_NOT_UAT_VERIFIED` | Shared recommend + submit |
| Permissioned loading decision | `IMPLEMENTED_NOT_UAT_VERIFIED` | `POST .../loading-decision` |
| Loading decision statuses | `IMPLEMENTED_AND_VERIFIED` | Shared + Prisma enums |
| `reinspectionOfId` linkage | `IMPLEMENTED_AND_VERIFIED` | Schema + truck draft DTO |
| Re-inspection picker UI | `PARTIALLY_IMPLEMENTED` | DEF-002 OPEN — API yes, picker no |
| Inspection chain / prior-failure UX | `PARTIALLY_IMPLEMENTED` | Display when linked; no full chain UI |
| Conditional approval rules | `BLOCKED_BY_BUSINESS_DECISION` | BD-11/12 + policies table |
| Temperature limits source of truth | `BLOCKED_BY_BUSINESS_DECISION` | BD-14/15; profiles exist as admin data |
| Final loading authority | `BLOCKED_BY_BUSINESS_DECISION` | BD-10 PENDING |

---

## G. Corrective Action

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Auto-create on configured fail | `IMPLEMENTED_NOT_UAT_VERIFIED` | Submit path |
| CA permissions | `IMPLEMENTED_AND_VERIFIED` | `corrective_actions:read|manage` |
| CA categories master data | `IMPLEMENTED_NOT_UAT_VERIFIED` | Admin master-data |
| CA report kinds (e.g. overdue) | `PARTIALLY_IMPLEMENTED` | Reports only |
| Full status lifecycle | `PARTIALLY_IMPLEMENTED` | Thin enum vs required enterprise set |
| Assign / reassign / progress / evidence APIs | `PARTIALLY_IMPLEMENTED` | Fields/models exist; **no CA controller** |
| My Actions / Team / Overdue UIs | `PARTIALLY_IMPLEMENTED` | Placeholder page only (DEF-006) |
| CA ownership / SLA policies | `BLOCKED_BY_BUSINESS_DECISION` | BD-08/22/23 PENDING |
| Offline CA submit | `PARTIALLY_IMPLEMENTED` | Queue type stub; sync no-op |

---

## H. Non-conformity

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Failed item as NC implicitly | `PARTIALLY_IMPLEMENTED` | Result + CA auto-create |
| Formal NonConformity entity | `PLANNED` | Pending QA decision (Phase 4) |
| Duplicate NC prevention | `NOT_APPLICABLE` | Until entity approved |

---

## I. Amendments

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| `records:amend` permission | `IMPLEMENTED_AND_VERIFIED` | Seed / permissions |
| `ApprovalType.AMEND` | `PARTIALLY_IMPLEMENTED` | Enum only |
| Request / approve / revision link | `PLANNED` | DEF-005 amend thin |
| Report current-revision selection | `PLANNED` | — |

---

## J. Reports, KPIs, analytics

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Operational report kinds + CSV | `IMPLEMENTED_NOT_UAT_VERIFIED` | Prompt 31; formula escape |
| Official record PDF | `IMPLEMENTED_NOT_UAT_VERIFIED` | PDFKit; not crypto signature |
| Task dashboard summary metrics | `IMPLEMENTED_NOT_UAT_VERIFIED` | `/tasks` |
| Governed KPI definitions doc | `PLANNED` | Phase 11 |
| Executive KPI dashboard | `PLANNED` | — |
| Dashboard/source reconciliation tests | `PLANNED` | — |

---

## K. Administration and master data

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Users admin | `IMPLEMENTED_NOT_UAT_VERIFIED` | Soft deactivate; last-admin guard |
| Departments / sections / shifts | `IMPLEMENTED_NOT_UAT_VERIFIED` | — |
| Failure reasons / CA categories | `IMPLEMENTED_NOT_UAT_VERIFIED` | — |
| Temperature profiles / loading policies | `IMPLEMENTED_NOT_UAT_VERIFIED` | Admin-supplied content only |
| Vehicles / drivers / transporters | `IMPLEMENTED_NOT_UAT_VERIFIED` | QR identifier on vehicle |
| Product / Batch / Shipment / Bay | `PLANNED` | Add only if required now (Phase 8) |
| ERP integration adapters | `PLANNED` | Disabled-not-configured pattern (Phase 8) |
| ERP vs local master-data source | `BLOCKED_BY_BUSINESS_DECISION` | BD-24 PENDING |

---

## L. Notifications and escalation

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Notification persistence | `PARTIALLY_IMPLEMENTED` | Prisma model |
| Emit on check/verify/return/reject | `PARTIALLY_IMPLEMENTED` | Private `notifyUser` |
| In-app inbox / read-unread API | `PLANNED` | Phase 10 |
| CA / loading / backup event coverage | `PLANNED` | Types partially exist unused |
| Email / SMS / WhatsApp channels | `PLANNED` | Do not claim active |

---

## M. Evidence storage

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Attachment model + upload path | `PARTIALLY_IMPLEMENTED` | Working for checklists |
| MIME / size / hash / private access hardening | `PARTIALLY_IMPLEMENTED` | Phase 9 review required |
| Malware scan integration point | `PLANNED` | — |
| Retention policy enforcement | `BLOCKED_BY_BUSINESS_DECISION` | BD-18 PENDING |

---

## N. Localization and operator usability

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| English UI | `IMPLEMENTED_NOT_UAT_VERIFIED` | Hard-coded |
| Sinhala / central i18n | `PLANNED` | Phase 12 |
| Asia/Colombo consistency | `PARTIALLY_IMPLEMENTED` | Some locale formatting; not governed |
| Formal UX metrics study | `PLANNED` | Pilot / Phase 12 |

---

## O. Observability

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Basic Nest logging / health | `PARTIALLY_IMPLEMENTED` | — |
| Correlation + user-safe error refs | `PLANNED` | Phase 13 |
| Background job / backup failure monitors | `PLANNED` | — |

---

## P. Quality evidence gates

| Capability | Status | Evidence / notes |
|------------|--------|------------------|
| Automated unit/API tests | `IMPLEMENTED_AND_VERIFIED` | Engineering gate |
| DB integration tests (when infra up) | `IMPLEMENTED_AND_VERIFIED` | Soft-skip if unavailable |
| Playwright critical-path subset | `PARTIALLY_IMPLEMENTED` | Expand in Phase 14 |
| Formal multi-role UAT | `PLANNED` | DEF-012 OPEN — NOT EXECUTED |
| Backup / restore proven | `PLANNED` | DEF-011 OPEN — NOT EXECUTED |
| Controlled pilot | `PLANNED` | Docs only |
| Production deploy | `NOT_APPLICABLE` | NO-GO; not performed |

---

## Q. Inventory counts (capability rows above)

Approximate distribution for planning (platform through quality sections):

| Status | Approx. share |
|--------|---------------|
| `IMPLEMENTED_AND_VERIFIED` | Minority — foundation & enums/permissions |
| `IMPLEMENTED_NOT_UAT_VERIFIED` | Largest — core MVP workflows awaiting plant UAT |
| `PARTIALLY_IMPLEMENTED` | Significant — CA, reinspect UI, SoD interim, notifications, evidence |
| `BLOCKED_BY_BUSINESS_DECISION` | Material — BD-01–25 pack |
| `PLANNED` | Material — enterprise phases 3–16 gaps |
| `NOT_APPLICABLE` | Few — e.g. prod deploy, NC until decided |
