# Current System Audit — Nelna FG Digital Recording System

**Date:** 2026-07-15
**Branch:** `main`
**Starting SHA:** `97ef2fd`
**Safety tag:** `pre-enterprise-improvement-20260715-0112`
**Auditor:** Engineering agent (Chinthaka Jayaweera author config)
**Gate posture:** Production **NO-GO** until formal plant UAT + restore evidence (see `docs/release/FINAL_GO_LIVE_DECISION.md`)

## Executive summary

The platform is a MongoDB Atlas–backed NestJS + Next.js monorepo with GridFS evidence, same-origin Cloudflare `/api` proxy scaffolding, Render API config, production-safe seeding, and sample operational cleanup (admin temporarily retained). Core cleaning/truck inspection workflows, check/verify, admin master data, reports/PDF/CSV, and offline queue **exist with automated tests**. Corrective Action lifecycle API/UI and truck re-inspection candidate picker shipped this enterprise pass (**READY_FOR_QA**, not plant-closed). Formal multi-role plant UAT and proven backup/restore are **not executed**.

## Architecture (actual)

| Layer | Status |
|-------|--------|
| Frontend Next.js App Router | Active |
| Cloudflare OpenNext / Wrangler | Artifacts present; live Worker deploy not verified this session |
| NestJS API | Active; listens `0.0.0.0` / `PORT` |
| Render `render.yaml` | Present |
| MongoDB Atlas `fg_online` | Active Prisma provider |
| GridFS `fgEvidence` | Implemented |
| Same-origin `/api` proxy | Implemented |
| Browser → MongoDB | Forbidden (not present) |

## Capability classification

| Capability | Classification | Notes |
|------------|----------------|-------|
| Auth login/refresh/logout/lockout | IMPLEMENTED_NOT_UAT_VERIFIED | Specs + prior smoke |
| RBAC permissions/guards/middleware | IMPLEMENTED_NOT_UAT_VERIFIED | |
| Users + admin master data | IMPLEMENTED_NOT_UAT_VERIFIED | Soft-deactivate |
| CL/24 Daily Cleaning | IMPLEMENTED_NOT_UAT_VERIFIED | Template published |
| CL/30 Freezer Truck | IMPLEMENTED_NOT_UAT_VERIFIED | Critical loading block |
| Draft/submit/check/verify/return/void | IMPLEMENTED_NOT_UAT_VERIFIED | SoD defaults; BD pending |
| Loading decision | IMPLEMENTED_NOT_UAT_VERIFIED | Non-overridable block |
| Today’s Tasks (one-shot) | IMPLEMENTED_NOT_UAT_VERIFIED | Recurring schedules PLANNED |
| Corrective Action lifecycle | IMPLEMENTED_NOT_UAT_VERIFIED | Module + UI; READY_FOR_QA (DEF-006) |
| Truck re-inspection picker | IMPLEMENTED_NOT_UAT_VERIFIED | Candidates API + FreezerTruckForm (DEF-002) |
| Verified-record amendment | PARTIALLY_IMPLEMENTED | Void exists; amend thin |
| Fleet admin | IMPLEMENTED_NOT_UAT_VERIFIED | |
| Reports/PDF/CSV | IMPLEMENTED_NOT_UAT_VERIFIED | |
| Notifications inbox | PARTIALLY_IMPLEMENTED | Write-side only |
| Audit logs | IMPLEMENTED_NOT_UAT_VERIFIED | |
| GridFS upload/download | IMPLEMENTED_NOT_UAT_VERIFIED | |
| PWA/offline queue | IMPLEMENTED_NOT_UAT_VERIFIED | CA offline sync no-op |
| Mongo schema/guards | IMPLEMENTED_AND_VERIFIED | |
| Sample cleanup + demo seed block | IMPLEMENTED_AND_VERIFIED | Admin still protected |
| Health endpoints | IMPLEMENTED_AND_VERIFIED | |
| CI quality + Mongo integration | IMPLEMENTED_AND_VERIFIED | E2E continue-on-error |
| Formal plant UAT | PLANNED | DEF-012 |
| Restore proof | PLANNED | DEF-011 |
| ERP/SFA | NOT_APPLICABLE / PLANNED | No fake integrations |

## Do not rebuild

Auth, checklist engine, inspection workflow, truck critical block, admin CRUD, reports exports, `/api` proxy, Mongo/GridFS scaffolding, production-safe seed.

## Open business decisions

BD-01–BD-25 remain PENDING in `docs/approvals/`. Interim SoD and loading-block defaults are code-enforced pending approval.

## Honest verification bound

Automated engineering verification ≠ plant acceptance. This audit upgrades docs to Mongo reality and drives CA/re-inspection completion next.
