# MongoDB Migration Plan — Nelna FG Digital Recording System

**Branch:** `feature/mongodb-atlas-migration`  
**Baseline SHA:** `33c3ebc`  
**Target database:** Atlas database **`fg_online`**  
**Test database:** **`fg_online_test`** (never run destructive tests against `fg_online`)  
**Companion docs:** `MONGODB_MIGRATION_AUDIT.md`, `POSTGRESQL_TO_MONGODB_MAPPING.md`

This plan becomes executable only after the audit is accepted. Schema provider changes follow this document — not before.

---

## 1. Objectives

1. Move all structured application persistence to MongoDB Atlas `fg_online`.  
2. Use **domain-specific collections** (never one generic collection).  
3. Preserve business safety controls (immutability, uniqueness, SoD, loading block, audit).  
4. Keep secrets out of Git; never commit passwords or authenticated URIs.  
5. Prove connectivity, seed idempotency, and reconciliation honestly — no fabricated PASS.

---

## 2. Non-goals

- Merge to `main` or claim production cutover without evidence.  
- Invent ERP / GridFS unless explicitly required.  
- Run `prisma migrate dev|deploy|reset` against MongoDB.  
- Delete PostgreSQL source data during migration.  
- Store real Atlas password in `.env.example` or documentation.

---

## 3. Phased execution

### Phase A — Audit & plan (THIS PHASE)

**Status:** Complete when the three docs exist on the feature branch.

Deliverables:

- `MONGODB_MIGRATION_AUDIT.md`  
- `MONGODB_MIGRATION_PLAN.md` (this file)  
- `POSTGRESQL_TO_MONGODB_MAPPING.md`

**Do not** change `provider` until Phase A is complete.

### Phase B — Schema conversion

1. Confirm Prisma version MongoDB support.  
2. Convert `datasource` to `mongodb`.  
3. Convert every model per mapping doc:
   - Surrogate `id` with `@default(auto()) @map("_id") @db.ObjectId` (or documented alternative if cuid retained — **default: ObjectId** for Atlas-native IDs).  
   - Relation scalars `@db.ObjectId`.  
   - Replace composite `@@id` with `id` + `@@unique([...])`.  
   - Remove `@db.Date`; encode date-only as UTC midnight `DateTime` (document in mapping).  
   - Add `@@map("collectionName")` for each domain collection.  
4. Archive SQL migrations → `docs/database/postgresql-migration-archive/` (+ README explaining why).  
5. Add scripts: `prisma:validate`, `prisma:push`, keep `prisma:generate` / `prisma:seed`; deprecate migrate scripts for Mongo workflow.  
6. `prisma validate` + `prisma generate` locally against placeholder URL shape (no password in examples).

### Phase C — Environment, health, diagnostics

1. Update `apps/api/.env.example`:

```env
DATABASE_URL="mongodb+srv://<DB_USER>:<DB_PASSWORD>@cluster0.gsqzhij.mongodb.net/fg_online?retryWrites=true&w=majority&appName=Cluster0"
```

**Never** paste a real password into `.env.example`.

2. Local `apps/api/.env` (untracked) holds the real URI.  
3. Production validation:
   - URL scheme `mongodb` or `mongodb+srv`  
   - Path / DB name explicitly `fg_online`  
   - Reject placeholder tokens (`changeme`, `<DB_PASSWORD>`, empty password)  
4. Health:
   - Live = process up  
   - Ready = DB ping OK  
   - Safe diagnostic: provider MongoDB, connected bool, name `fg_online`, cluster/credentials hidden  
5. Replace `$queryRaw\`SELECT 1\`` with Mongo-compatible ping (`$runCommandRaw({ ping: 1 })` or equivalent).

### Phase D — Application integrity layers

Where Mongo cannot enforce FKs:

| Former PG behaviour | Replacement |
|---------------------|-------------|
| `onDelete: Cascade` | Service-level cascade deletes / soft-delete policy + tests |
| `onDelete: Restrict` | Pre-delete existence checks + tests |
| `onDelete: SetNull` | Explicit nulling or leave orphan policy documented |
| Nullable unique | Sparse unique indexes where Prisma supports; else app checks |

Do **not** remove SoD, loading-block, or immutability checks.

### Phase E — Seed

1. Idempotent upserts by natural keys / unique compounds.  
2. Seed roles, permissions, mappings, departments, sections, shifts, CL/24, CL/30 + versions/items, fleet samples, failure reasons / CA categories / temperature profiles / loading policies as today.  
3. Users only when `SEED_*` env vars set.  
4. Prove second seed run creates no duplicates.  
5. Never hard-code production passwords.

### Phase F — `db push` + Atlas verify

1. Confirm `DATABASE_URL` targets **`fg_online`** (not test).  
2. `pnpm --filter @nelna/api exec prisma db push`  
3. `pnpm --filter @nelna/api exec prisma db seed`  
4. Second seed — zero duplicates.  
5. List collections in Atlas (Studio / mongosh) — document in evidence file **without** credentials.

### Phase G — Existing data migration

**Decision tree:**

```text
IF PostgreSQL export URI available AND counts > seed-only baseline
  THEN export → transform (cuid→ObjectId map) → import → reconcile
ELSE
  Document NO required operational records found / unreachable
  Initialize Mongo from seed only
  Do NOT invent migrated counts
```

Ordered import (dependencies):

1. Roles → Permissions → RolePermissions  
2. Departments → Sections → Shifts  
3. Users → UserRoles → RefreshTokens (usually skip prod refresh tokens)  
4. ChecklistTemplates → Versions → Sections → Items → Options  
5. FailureReason / CorrectiveActionCategory / TemperatureProfile / LoadingDecisionPolicy  
6. Transporters → Vehicles → Drivers  
7. TaskAssignments  
8. InspectionRecords → Results → Attachments → TruckInspectionDetail → Approvals  
9. CorrectiveActions → Evidence  
10. Notifications → AuditLogs  

Scripts (create only if PG data exists):

- `scripts/database/export-postgresql-data.ts`  
- `scripts/database/transform-for-mongodb.ts`  
- `scripts/database/import-mongodb-data.ts`  
- `scripts/database/reconcile-migration.ts`  

Maintain **old-id → new ObjectId** map. Never overwrite source PG.

### Phase H — Reconciliation & evidence

Create (with honest status):

- `docs/database/MONGODB_MIGRATION_EVIDENCE.md`  
- `docs/database/MONGODB_RECONCILIATION_REPORT.md`  
- `docs/database/MONGODB_ROLLBACK_PLAN.md`

PASS only if counts match or every difference is documented and accepted.

### Phase I — Tests & CI

1. Separate `DATABASE_URL` for `fg_online_test`.  
2. Rewrite DB integration/constraint tests for Mongo indexes + app Restrict.  
3. Update CI: no Postgres service / `migrate deploy`; use Mongo service or Atlas test URI secrets (not production password in logs).  
4. Clean test DB between suites safely.

### Phase J — Documentation & PR

Update README, ARCHITECTURE, DATABASE_DESIGN, DEVELOPMENT_WORKFLOW, ENVIRONMENT_MATRIX, DEPLOYMENT_RUNBOOK, BACKUP_RESTORE_RUNBOOK, DATA_RECONCILIATION, SECURITY_REVIEW, KNOWN_LIMITATIONS.

Commit when gates pass:

```text
refactor: migrate FG platform persistence to MongoDB Atlas
```

Push: `git push -u origin feature/mongodb-atlas-migration`  
PR: `feature/mongodb-atlas-migration` → `develop`  
**Do not** merge to `main`.

---

## 4. Collection naming (authoritative)

| Collection | Prisma model |
|------------|--------------|
| `users` | User |
| `roles` | Role |
| `permissions` | Permission |
| `userRoles` | UserRole |
| `rolePermissions` | RolePermission |
| `refreshTokens` | RefreshToken |
| `departments` | Department |
| `sections` | Section |
| `shifts` | Shift |
| `checklistTemplates` | ChecklistTemplate |
| `checklistTemplateVersions` | ChecklistTemplateVersion |
| `checklistSections` | ChecklistSection |
| `checklistItems` | ChecklistItem |
| `checklistItemOptions` | ChecklistItemOption |
| `taskAssignments` | TaskAssignment |
| `inspectionRecords` | InspectionRecord |
| `inspectionResults` | InspectionResult |
| `inspectionAttachments` | InspectionAttachment |
| `approvalRecords` | ApprovalRecord |
| `correctiveActions` | CorrectiveAction |
| `correctiveActionEvidence` | CorrectiveActionEvidence |
| `vehicles` | Vehicle |
| `drivers` | Driver |
| `transporters` | Transporter |
| `truckInspectionDetails` | TruckInspectionDetail |
| `failureReasons` | FailureReason |
| `correctiveActionCategories` | CorrectiveActionCategory |
| `temperatureProfiles` | TemperatureProfile |
| `loadingDecisionPolicies` | LoadingDecisionPolicy |
| `notifications` | Notification |
| `auditLogs` | AuditLog |
| `systemSettings` | *(optional future — not in current schema; do not invent until needed)* |

---

## 5. ID and date strategy

| Topic | Decision |
|-------|----------|
| Primary keys | MongoDB `ObjectId` via Prisma `@default(auto()) @map("_id") @db.ObjectId` |
| Relation FKs | `String @db.ObjectId` |
| Historical cuid values from PG | Map during import; new Mongo docs use ObjectId |
| Date-only fields | Store as `DateTime` at UTC midnight; compare on date portion in app where needed |
| Enums | Prisma enums → string values in Mongo |

---

## 6. GridFS decision

**Decision:** **Deferred / not required for Phase B–F.**  
Binary evidence remains private file storage (or existing path) with **metadata in MongoDB**. Introduce GridFS only after explicit business confirmation.

---

## 7. Rollback plan (summary)

1. Keep PostgreSQL instance and archived migrations.  
2. Feature branch revert / do not merge if gates fail.  
3. Point `DATABASE_URL` back to PostgreSQL only after restoring `provider = "postgresql"` from Git history.  
4. Detailed steps: `MONGODB_ROLLBACK_PLAN.md` (Phase H).

---

## 8. Quality gates before commit of conversion

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @nelna/api prisma:validate
pnpm --filter @nelna/api prisma:generate
# After confirming URL targets the intended DB:
pnpm --filter @nelna/api exec prisma db push
pnpm --filter @nelna/api exec prisma db seed
# Second seed — no duplicates
```

Staged-diff secret scan mandatory.

---

## 9. Atlas manual checklist (operators)

- [ ] Database user with least privilege on `fg_online`  
- [ ] IP access list (dev / CI / prod)  
- [ ] Separate user or DB for `fg_online_test`  
- [ ] Atlas backup enabled (do not claim automation until tested)  
- [ ] Password rotated if ever pasted into chat, tickets, or `.env.example`  
- [ ] Network timeout / SRV DNS verified from API host  

---

## 10. Merge readiness criteria

PR to `develop` is **not** safe until:

- Schema validates and generates  
- `db push` + seed succeed on Atlas `fg_online`  
- Second seed idempotent  
- Tests + build pass  
- Reconciliation documented (PASS or documented seed-only)  
- No secrets in Git  

Production/`main` remains governed by the existing **NO-GO** release gate unless separately approved.
