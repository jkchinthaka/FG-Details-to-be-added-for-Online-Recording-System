# Implementation Inventory — Nelna FG (MongoDB era)

**Updated:** 2026-07-15 · **SHA base:** `97ef2fd` · **Branch:** `main`

> Supersedes PostgreSQL-era inventory rows. Provider is MongoDB Atlas `fg_online`.

| Module | Paths | Status |
|--------|-------|--------|
| Auth | `apps/api/src/auth/*`, `apps/web` login | IMPLEMENTED_NOT_UAT_VERIFIED |
| RBAC | shared permissions + guards + middleware | IMPLEMENTED_NOT_UAT_VERIFIED |
| Checklist engine | shared + UI ChecklistRenderer | IMPLEMENTED_NOT_UAT_VERIFIED |
| CL/24 / CL/30 templates | seed-data + published versions | IMPLEMENTED_NOT_UAT_VERIFIED |
| Inspection workflow | `inspection-records` | IMPLEMENTED_NOT_UAT_VERIFIED |
| Truck loading decision | truck detail + API | IMPLEMENTED_NOT_UAT_VERIFIED |
| Corrective Actions lifecycle | `corrective-actions` module + web UI | IMPLEMENTED_NOT_UAT_VERIFIED (new) |
| Re-inspection candidates | GET reinspection-candidates + FreezerTruckForm picker | IMPLEMENTED_NOT_UAT_VERIFIED (new) |
| Admin/master/fleet | users, master-data, vehicles | IMPLEMENTED_NOT_UAT_VERIFIED |
| Reports/PDF/CSV | reports module | IMPLEMENTED_NOT_UAT_VERIFIED |
| GridFS evidence | evidence module | IMPLEMENTED_NOT_UAT_VERIFIED |
| Offline/PWA | queue-store, sw.js | IMPLEMENTED_NOT_UAT_VERIFIED |
| `/api` proxy | Next route handler | IMPLEMENTED_AND_VERIFIED |
| Sample cleanup / demo seed split | scripts + seed.ts | IMPLEMENTED_AND_VERIFIED |
| Recurring schedules | — | PLANNED |
| Full amendment revisions | void only | PARTIALLY_IMPLEMENTED |
| Notification inbox API | write-side only | PARTIALLY_IMPLEMENTED |
| Formal plant UAT | docs only | PLANNED |
| Restore proof | docs only | PLANNED |
