# MongoDB Reconciliation Report — fg_online

**Date:** 2026-07-15  
**Branch:** `main`  
**Cluster:** `cluster0.gsqzhij.mongodb.net` (credentials hidden)  
**Database:** `fg_online`

## Connectivity

| Check | Result |
|-------|--------|
| Prisma `db push` | PASS |
| Seed (first) | PASS (after Mongo null-unique seed fixes) |
| Seed (second) | PASS — no duplicate operational master data |
| PostgreSQL source export | NOT ACCESSIBLE / not required — seed-only initialization |

## Document counts (post double-seed)

| Collection (model) | Count |
|--------------------|------:|
| users | 3 |
| roles | 6 |
| permissions | 19 |
| departments | 1 |
| sections | 3 |
| shifts | 3 |
| checklist_templates | 2 |
| checklist_template_versions | 2 |
| checklist_items | 24 |
| vehicles | 3 |
| drivers | 2 |
| transporters | 2 |
| task_assignments | 2 |
| inspection_records | 0 |
| inspection_results | 0 |
| approval_records | 0 |
| corrective_actions | 0 |
| notifications | 0 |
| audit_logs | 0 |

Operational inspection history was empty at cutover (no fabricated migrated plant records).

## GridFS

| Item | Status |
|------|--------|
| Bucket name | `fgEvidence` |
| Driver | official `mongodb` package |
| Metadata fields | on `inspection_attachments` / `corrective_action_evidence` |
| Live upload smoke | Code wired; full plant evidence smoke pending Render/Cloudflare deploy |

## Decision

Source historical migration: **NOT REQUIRED / NOT ACCESSIBLE**  
Mongo initialization: **SEED COMPLETE**  
Full end-to-end public deploy smoke: **PENDING credentials** (see deployment blockers)
