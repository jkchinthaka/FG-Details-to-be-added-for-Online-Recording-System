# Current MVP Baseline — Nelna FG Digital Recording System

**Documented:** 2026-07-14 (Prompt 26)  
**Developer:** Chinthaka Jayaweera  
**Repository:** https://github.com/jkchinthaka/FG-Details-to-be-added-for-Online-Recording-System.git  

This snapshot describes the synchronized MVP baseline after branch normalization. It does **not** invent business policy or claim new test results beyond what was executed in this phase / prior documented gates.

---

## Current commit

| Item | Value |
|------|--------|
| Synchronized tip (before this docs commit) | `214fc2b0164b255033872985539d874629728baa` |
| Meaning | Merge PR #1 of `develop` into `main`, then `develop` fast-forwarded to match |
| Annotated release tag | `v1.0.0` → points at `d863abe` (Prompt 25 gate commit) |

---

## Current branches

| Ref | SHA (post Prompt 26 sync) | Notes |
|-----|---------------------------|--------|
| `develop` / `origin/develop` | `214fc2b` | Active implementation branch |
| `main` / `origin/main` | `214fc2b` | Same tip after FF sync |
| Relationship | Identical tips | `develop` was ancestor of `main` merge commit; FF-only sync applied |

**Policy:** Continue all implementation on `develop`. Do not force-push. Do not rewrite history. Promote to `main` only under an approved release gate.

---

## Implemented features

- pnpm monorepo: Next.js web, NestJS API, shared domain, UI design system  
- Nelna brand shell, mobile-first layout, design tokens  
- PostgreSQL + Prisma domain model (users, roles, templates, records, CA, audit, truck detail)  
- Auth: JWT cookies, lockout, inactive refusal, API RBAC  
- Today’s Tasks dashboard  
- Daily cleaning (`NMS/PPU/CL/24`) draft → submit, evidence rules, duplicate draft handling  
- Freezer truck (`NMS/PPU/CL/30`) draft → submit, critical loading block, permissioned loading decision  
- Versioned checklist template engine (draft / publish / archive immutability)  
- Corrective-action **auto-create** on configured fails (submit path)  
- Admin/master-data APIs + minimal web admin (Prompt 32): user lifecycle & role/department assignment, department/section/shift/failure-reason/corrective-action-category/temperature-profile management, loading-decision-policy storage, fleet (vehicle/driver/transporter) administration, checklist template draft cloning  
- Health: `/health`, `/health/live`, `/health/ready`; production env fail-closed  
- Documentation packs: requirements, security, performance, database, UAT, operations, handover, release, queue controller  

---

## Incomplete features

| Area | Status |
|------|--------|
| Checked By / Verified By / Return workflow | Missing (DEF-003, DEF-001) |
| Self-check / self-verify policy enforcement | Missing (DEF-004) |
| CA assignment, evidence, overdue, closure UI/API | Incomplete (DEF-006) |
| Truck re-inspection picker / full chain UI | Incomplete (DEF-002) |
| Reports / PDF / CSV | Delivered (Prompt 31); BD-25 paper parity PENDING |
| Offline sync (service worker) | Deferred (DEF-009) |
| Web route authorization | Verified `/auth/me` + role ACL (Prompt 33; DEF-010 closed product) |
| Void / amendment of verified records | Missing (DEF-005) |

---

## Open defects

See `docs/uat/DEFECT_REGISTER.md`.

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| DEF-001 | High | Supervisor general Return missing | Open |
| DEF-002 | High | Truck re-inspection UI incomplete | Open |
| DEF-003 | High | Check / Verify transitions missing | Open |
| DEF-004 | High | Self-verification restriction not enforceable | Open |
| DEF-005 | Medium | Void / amend process missing | Open |
| DEF-006 | High | CA lifecycle incomplete | Open |
| DEF-007 | High | Reports / PDF / CSV | Closed (product); plant UAT unsigned |
| DEF-008 | High | Admin user & vehicle CRUD missing | Closed (product); see `DEFECT_REGISTER.md` |
| DEF-009 | Medium | Offline sync missing | Open |
| DEF-010 | Medium | Web middleware route auth | Closed (product); residual access-token TTL |
| DEF-011 | High | DB restore not proven | Open |
| DEF-012 | High | Formal multi-role UAT not executed | Open |

Critical open: **0**. High open: **8**.

---

## Open business decisions

See `docs/requirements/OPEN_BUSINESS_DECISIONS.md` (OBD-01–OBD-20). None are engineering-approved inventions. Prompt 27 will map these into a formal BD decision pack for management sign-off.

Highlights still required: record frequency, Check/Verify roles and SoD, correction/CA/evidence mandates, critical truck items, loading authorization, temperature, backdating, retention, e-approval, offline/paper fallback, CA ownership, ERP vs local masters, PDF layout fidelity.

---

## Test status (Prompt 26 verification)

| Check | Result |
|-------|--------|
| `pnpm format:check` | **Fail** — Prettier drift (249 files reported); pre-existing; not mass-fixed in this phase |
| `pnpm lint` | **Pass** |
| `pnpm typecheck` | **Pass** |
| `pnpm test` | **Pass** — 383 passed / 0 failed (shared 93 + ui 31 + api 164 + web 95) |
| `pnpm build` | **Pass** |
| Prisma validate | **Pass** |
| Formal UAT | **Not executed** — prepared only (`docs/uat/`) |
| Live DB restore | **Not executed** — prepared but not executed due to unavailable production infrastructure, authorization or business user access |

---

## Build status

Production web + API build executed as part of Prompt 26 mandatory verification (see phase report). No production hosting deploy was performed.

---

## Database status

| Item | Status |
|------|--------|
| Prisma schema | Present; migrations under `apps/api/prisma/migrations/` |
| Live migrate/seed in this environment | Often blocked (Postgres auth / Docker historically unavailable) |
| Backup/restore runbooks | Documented; restore **not proven** (DEF-011) |
| Soft archive vs physical delete | Design: do not hard-delete verified quality records via product APIs |

---

## Release status

| Item | Status |
|------|--------|
| Go-live decision | **CONDITIONAL GO** (`docs/release/GO_LIVE_DECISION.md`) |
| Tag | `v1.0.0` (single annotated tag; do not duplicate) |
| Production claim | **No** production deployment verified |
| IT / Food Safety countersignature | Pending |

---

## Recommended next implementation sequence

1. **Prompt 27** — Nelna business decision & approval gate (no invented answers).  
2. **Prompt 28** — Check / Verify / Return workflow (permission-configurable while BD pending).  
3. **Prompt 29** — Corrective action lifecycle module.  
4. **Prompt 30** — Truck re-inspection & final loading authorization.  
5. Then: reports/PDF, admin CRUD, proven restore, signed UAT, dependency/format hygiene, unconditional GO only with evidence.

Do **not** hard-code production-specific Nelna policies until status is **APPROVED** in the approvals pack.

---

## References

- `README.md`  
- `docs/release/GO_LIVE_DECISION.md`  
- `docs/release/KNOWN_LIMITATIONS.md`  
- `docs/release/TEST_SUMMARY.md`  
- `docs/uat/DEFECT_REGISTER.md`  
- `docs/requirements/OPEN_BUSINESS_DECISIONS.md`  
- `docs/security/SECURITY_REVIEW.md`  
- `docs/engineering/TECHNICAL_DEBT_REGISTER.md`  
- `docs/QUEUE_CONTROLLER.md`  
