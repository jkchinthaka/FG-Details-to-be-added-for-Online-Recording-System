# Bug and Risk Register — Enterprise Audit Snapshot

**Date:** 2026-07-15 · **Branch:** `main`

## Critical (open): 0

## High (product)

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| DEF-006 | Corrective Action lifecycle | FIXED → READY_FOR_QA | API + list/detail UI + transitions shipped this pass |
| DEF-002 | Truck re-inspection picker | FIXED → READY_FOR_QA | Candidates API + FreezerTruckForm link picker shipped |

## High (process / ops)

| ID | Title | Status |
|----|-------|--------|
| DEF-011 | Backup/restore not proven in this session | OPEN |
| DEF-012 | Formal multi-role plant UAT unsigned | OPEN |

## Medium

| ID | Title | Status |
|----|-------|--------|
| DEF-005 | Controlled amendment thin | OPEN (void exists) |
| RISK-ADMIN | Sample admin EMP-ADMIN-001 retained | OPEN until BOOTSTRAP_ADMIN_* |
| RISK-NOTIFY | No notification inbox API | OPEN |
| RISK-E2E | Playwright CI continue-on-error | OPEN |

## Business decision risk

BD-01–BD-25 PENDING — interim SoD/loading defaults remain code policy until approvals.

## Deployment risk

Render/Cloudflare live cutover blocked without `RENDER_API_KEY` / `CLOUDFLARE_API_TOKEN` in this environment.
