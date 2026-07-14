# MongoDB Migration Audit — Nelna FG Digital Recording System

**Branch:** `feature/mongodb-atlas-migration`  
**Starting commit:** `33c3ebcaaf1513ed5a942bc4535af23d7c1f8380`  
**Audit date:** 2026-07-14  
**Auditor:** Repository source-of-truth review (no schema provider change in this phase)  
**Target cluster (logical):** Atlas `Cluster0` / host `cluster0.gsqzhij.mongodb.net`  
**Target database name:** `fg_online`  
**Test database name (planned):** `fg_online_test`

**Security:** Connection credentials must exist only in untracked `apps/api/.env`. This document never contains passwords or a full authenticated URI. Prefer placeholders: `mongodb+srv://<DB_USER>:<DB_PASSWORD>@cluster0.gsqzhij.mongodb.net/fg_online?...`

---

## 1. Executive verdict

| Finding | Status |
|---------|--------|
| Current Prisma provider | **postgresql** (`apps/api/prisma/schema.prisma`) |
| Models / enums | **31 models**, **14 enums** |
| Domain-specific collections planned | Yes — not a single generic collection |
| SQL migrations | **10** under `apps/api/prisma/migrations/` + `migration_lock.toml` (postgresql) |
| Raw SQL in app | Health + integration tests: `$queryRaw\`SELECT 1\`` |
| `$transaction` usage | Present (inspection records, templates, users) — Atlas replica-set transactions required |
| Backup tooling | **pg_dump / pg_restore / psql** — must be replaced |
| CI / Docker | PostgreSQL 16 services and `migrate deploy` |
| Existing PG data export | **NOT COMPLETED** — see §8 |
| Schema conversion | **NOT STARTED** (blocked until this audit + plan are accepted) |

**Verdict:** Migration is **feasible** with Prisma MongoDB + `db push`, domain collections, application-enforced referential integrity where Mongo cannot cascade/restrict, and archival of PostgreSQL migrations. It is **high risk** for composite PKs (`UserRole`, `RolePermission`), `@db.Date`, cascade/`Restrict` semantics, and CI/test rewrite. Do **not** claim data migrated until Atlas connect + reconciliation evidence exist.

---

## 2. Current persistence landscape

### 2.1 Datasource

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Generator: `prisma-client-js` → `apps/api/generated/prisma-client`, `engineType = "library"`.

### 2.2 Models (31)

`User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `RefreshToken`, `Department`, `Section`, `Shift`, `ChecklistTemplate`, `ChecklistTemplateVersion`, `ChecklistSection`, `ChecklistItem`, `ChecklistItemOption`, `InspectionRecord`, `TaskAssignment`, `InspectionResult`, `InspectionAttachment`, `Transporter`, `Vehicle`, `Driver`, `TruckInspectionDetail`, `ApprovalRecord`, `CorrectiveAction`, `CorrectiveActionEvidence`, `FailureReason`, `CorrectiveActionCategory`, `TemperatureProfile`, `LoadingDecisionPolicy`, `Notification`, `AuditLog`.

**No `@@map` today** — PostgreSQL tables use default PascalCase names. MongoDB conversion should introduce explicit `@@map("camelCaseCollection")` for stable Atlas collection names.

### 2.3 PostgreSQL-specific annotations

| Annotation / pattern | Locations | Mongo impact |
|----------------------|-----------|--------------|
| `@db.Date` | `InspectionRecord.recordDate`, `TaskAssignment.dueDate` | No date-only type — use DateTime (UTC midnight) or string `YYYY-MM-DD`; document choice |
| Native enums | 14 enums | Stored as strings; app validation retained |
| `Json` / `Json?` | `LoadingDecisionPolicy.config`, `AuditLog.metadata` | BSON documents — supported |
| `Float` | Temps, min/max, profiles | BSON double — OK |
| Composite `@@id` | `UserRole`, `RolePermission` | **Must** become surrogate `_id` + `@@unique([...])` |
| `onDelete: Cascade / Restrict / SetNull` | Many relations | **Not DB-enforced** on Mongo — reimplement in services + tests |
| Nullable uniques | `User.email`, `CorrectiveAction.resultId`, optional vehicle fields | Need sparse/partial unique strategy |

### 2.4 Migrations (archive candidates)

| Migration folder |
|------------------|
| `20260714010000_init_domain_model` |
| `20260714020000_add_login_security_fields` |
| `20260714030000_add_checklist_item_type_and_rules` |
| `20260714040000_add_task_assignment` |
| `20260714040000_add_truck_inspection_time` |
| `20260714050000_add_truck_inspection_details` |
| `20260714060000_harden_submit_idempotency` |
| `20260714100000_expand_record_workflow_statuses` |
| `20260714120000_admin_master_data` |

Plus `migration_lock.toml` (`provider = "postgresql"`). Initial `20260713120000_init` may exist in history; confirm at archive time.

**Rule:** Do not run `prisma migrate *` against MongoDB. Archive under `docs/database/postgresql-migration-archive/`.

---

## 3. Application coupling outside schema

| Area | Path(s) | Change required |
|------|---------|-----------------|
| PrismaService | `apps/api/src/prisma/prisma.service.ts` | Comments + connect behaviour; regenerate client |
| Health | `apps/api/src/health/health.service.ts` | Replace `SELECT 1` with Mongo ping |
| Env validation | `apps/api/src/config/validate-production-env.ts` | Require `mongodb` / `mongodb+srv`, database name `fg_online` |
| Transactions | inspection-records, checklist-templates, users | Keep; verify Atlas replica set / transactional support |
| Seed | `prisma/seed.ts`, `seed-data.ts` | Upserts portable after ID/unique remap; idempotent second run |
| Docker | `docker-compose.yml`, `docker-compose.test.yml` | Replace Postgres services or use Atlas test DB |
| CI | `.github/workflows/ci.yml` | Remove `migrate deploy`; use `db push` + `fg_online_test` |
| Backup | `scripts/db/*` | mongodump / Atlas Backup |
| Integration tests | `db-integration.spec.ts`, `db-constraints.spec.ts` | Redesign FK Restrict assertions |
| Docs / README | Multiple | PostgreSQL → MongoDB Atlas |
| Package scripts | `apps/api/package.json` | Add `prisma:push`, `prisma:validate`; retire migrate for Mongo |

**Raw SQL:** Only health/integration `$queryRaw\`SELECT 1\`` — no `$executeRaw` in production services.

---

## 4. Business controls that must not weaken

| Control | Today | Mongo requirement |
|---------|-------|-------------------|
| Verified record immutability | Workflow + void path | Keep service guards |
| Template version history | Publish/archive + Restrict FKs | Unique indexes + app Restrict on delete |
| Task assignment uniqueness | `@@unique([assignedToId, templateCode, dueDate])` | Compound unique index + same dueDate encoding |
| SoD self-check/verify | App policy | Unchanged (not DB) |
| Critical loading block | App + recommendations | Unchanged |
| Re-inspection chain | Self-relation `reinspectionOfId` | Preserve ObjectId relation |
| CA ↔ result linkage | Unique nullable `resultId` | Sparse unique + app |
| Audit / refresh tokens | Cascade on user delete | App cascade or soft-delete policy |
| Submit idempotency | Transaction + uniqueness | Transaction + unique indexes |

---

## 5. Attachments / evidence

Structured metadata lives on `InspectionAttachment` / `CorrectiveActionEvidence` (`fileName`, `fileUrl` / URL fields, mime, size, uploader, timestamps).

**GridFS decision (this audit):** **Do not introduce GridFS** unless business explicitly requires binaries inside MongoDB. Prefer private object storage (or existing file path) + metadata in MongoDB collections. Current uploads include data-URL parsing paths — review in implementation without making evidence public.

---

## 6. Query / index drivers (for later `@@index`)

Matched to known API patterns:

- Auth: email, employeeCode, refresh tokenHash, token expiresAt  
- Tasks: assignedToId + dueDate, templateCode  
- Records: documentCode + recordDate, status, creator/checker/verifier, reinspectionOfId, templateVersionId  
- Truck: vehicleNumber, freezerTruckNumber, loadingDecision  
- CA: status + priority, assignedToId + status, dueDate  
- Audit: entityType + entityId, createdAt  
- Notifications: userId + isRead  

Full index list belongs in the mapping document and post-conversion schema review.

---

## 7. Environment and secrets audit

| Item | Finding |
|------|---------|
| `apps/api/.env` | Present locally; **must remain gitignored** |
| Active URL scheme (probe) | Prisma PostgreSQL client rejected URL — message indicated non-`postgres://` scheme. App cannot talk to either store until provider and URL align. |
| `.env.example` | Still documents `postgresql://…` placeholders |
| Password in chat / prompt | Treat as **compromised for docs purposes** — rotate Atlas DB password after migration; **never** put real password in `.env.example`, commits, or these docs |

Safe diagnostic contract (to implement later):

- Provider: MongoDB  
- Database connected: true/false  
- Database name: `fg_online`  
- Cluster details: hidden  
- Credentials: hidden  

---

## 8. Existing PostgreSQL data status

| Check | Result |
|-------|--------|
| Row-count export from PostgreSQL | **NOT EXECUTED** — active `DATABASE_URL` incompatible with current `provider = "postgresql"` |
| Fabricated migrated counts | **Forbidden** |
| Planned default if PG unreachable / empty | Seed-only initialization of `fg_online` |
| If PG later accessible with a separate export URI | Use ordered export/transform/import scripts (see migration plan) |

**Reconciliation status:** `NOT_STARTED` — do not mark PASS.

---

## 9. Dependency versions (constraints)

Confirm installed Prisma major in `apps/api/package.json` before conversion. Use only Prisma MongoDB-supported syntax for that version (`@id @default(auto()) @map("_id") @db.ObjectId`, relation `@db.ObjectId`, `@@unique`, `@@index`, no unsupported PG attributes).

---

## 10. Exit criteria for audit phase

- [x] Schema and coupling audited  
- [x] Risks catalogued  
- [x] Existing-data honesty recorded  
- [x] Companion plan + mapping documents created  
- [ ] Schema provider change — **blocked until plan review complete** (next implementation step)

See:

- `docs/database/MONGODB_MIGRATION_PLAN.md`  
- `docs/database/POSTGRESQL_TO_MONGODB_MAPPING.md`
