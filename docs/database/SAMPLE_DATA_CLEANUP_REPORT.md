# Sample data cleanup report — fg_online

**Date:** 2026-07-15  
**Database:** `fg_online` (cluster host redacted)  
**Script version:** 1.0.0  
**Starting Git SHA:** `a1f95e0`  
**Branch:** `main`

## Backup

| Item | Result |
|------|--------|
| Location | `.local-backups/fg-online-before-sample-cleanup-*` (gitignored) |
| Status | `BACKUP_OK` |
| Included | All Prisma-mapped collections + `fgEvidence.files` / `fgEvidence.chunks` |
| SHA-256 | Written into backup `MANIFEST.json` |
| Committed to Git | **No** |

## Dry-run

| Item | Result |
|------|--------|
| Mode | `--dry-run --database=fg_online` |
| Status | `DRY_RUN_OK` |
| Planned sample user deletions | 2 (operator + QA) |
| Protected sample admin | `EMP-ADMIN-001` retained |
| Planned task deletions | 2 |
| Planned fleet deletions | 3 vehicles, 2 drivers, 2 transporters |
| Planned inspection/history deletions | 0 (already empty) |
| GridFS planned deletions | 0 |
| Ambiguous | 0 |
| Real-data relation blockers | 0 |

## Execution

| Item | Result |
|------|--------|
| Mode | `--execute` |
| Status | `EXECUTED_ADMIN_PROTECTED` |
| Users deleted | 2 |
| User roles deleted | 2 |
| Task assignments deleted | 2 |
| Vehicles / drivers / transporters deleted | 3 / 2 / 2 |
| Inspection / CA / notifications / audits deleted | 0 / 0 / 0 / 0 |
| GridFS files deleted | 0 |

## Administrator safety

| Item | Result |
|------|--------|
| Real admins before cleanup | 0 |
| `BOOTSTRAP_ADMIN_*` | Missing |
| Outcome | **ADMIN_REPLACEMENT_BLOCKED** — final sample admin retained |
| Retained account | `EMP-ADMIN-001` / `admin@example.local` |

## Post-cleanup counts (application collections)

| Collection | Before | After |
|------------|-------:|------:|
| users | 3 | 1 |
| roles | 6 | 6 |
| permissions | 19 | 19 |
| user_roles | 3 | 1 |
| role_permissions | 55 | 55 |
| departments | 1 | 1 |
| sections | 3 | 3 |
| shifts | 3 | 3 |
| checklist_templates | 2 | 2 |
| checklist_template_versions | 2 | 2 |
| checklist_sections | 3 | 3 |
| checklist_items | 24 | 24 |
| task_assignments | 2 | 0 |
| inspection_records | 0 | 0 |
| vehicles | 3 | 0 |
| drivers | 2 | 0 |
| transporters | 2 | 0 |
| notifications | 0 | 0 |
| audit_logs | 0 | 0 |
| fgEvidence.files | 0 | 0 |
| fgEvidence.chunks | 0 | 0 |

## Configuration preserved

Roles, permissions, role mappings, departments, sections, shifts, and published checklist templates NMS/PPU/CL/24 and NMS/PPU/CL/30 (sections/items) were retained.

## Seed safety follow-up

- Default / production seed no longer creates demo fleet, users, or tasks.
- Demo seed requires `ENABLE_DEMO_SEED=true` and is refused when `NODE_ENV=production`.
- Scripts: `prisma:seed:production`, `prisma:seed:demo`.

## Final result

**SAMPLE_DATA_PARTIALLY_REMOVED_ADMIN_PROTECTED**

Remaining confirmed sample exception: temporary sample administrator retained until `BOOTSTRAP_ADMIN_*` values are provided and cleanup is re-run with `--execute`.
