# Migration Runbook — Nelna FG Digital Recording System

**Audience:** Developers, DBAs, IT Manager  
**Scope:** Prisma / PostgreSQL schema migrations for `apps/api`  
**Last reviewed:** 2026-07-14 (Prompt 21)

---

## 1. Principles

1. **Never edit an already-applied migration** in shared environments. Create a new migration instead.
2. **Application history is soft-archived**, not hard-deleted. Schema FK rules must protect quality records.
3. Migrations are the single source of truth for schema change; do not apply ad-hoc DDL in production without a matching Prisma migration.
4. Seed is **idempotent** and separate from migrate (`prisma migrate deploy` then `prisma db seed`).

---

## 2. Prisma schema validation

From the repo root (or `apps/api`):

```bash
pnpm --filter @nelna/api exec prisma validate
```

**Evidence (2026-07-14 local gate):** schema validates successfully (`The schema at prisma/schema.prisma is valid`).

Generate client after schema changes:

```bash
pnpm --filter @nelna/api exec prisma generate
```

---

## 3. Migration inventory and ordering

Prisma applies folders under `apps/api/prisma/migrations/` in **lexicographic order** of directory name.

| Order | Directory | Purpose |
|------:|-----------|---------|
| 1 | `20260714010000_init_domain_model` | Core domain (users, roles, templates, records, CA, audit) |
| 2 | `20260714020000_add_login_security_fields` | Login lockout / security fields |
| 3 | `20260714030000_add_checklist_item_type_and_rules` | Item types and validation rules |
| 4 | `20260714040000_add_task_assignment` | Today’s Tasks assignments |
| 5 | `20260714040000_add_truck_inspection_time` | Truck `inspectionTime` column |
| 6 | `20260714050000_add_truck_inspection_details` | Re-inspection link + transporter on truck detail |
| 7 | `20260714060000_harden_submit_idempotency` | Unique CA↔result for submit idempotency |

**Ordering note:** Two directories share the timestamp prefix `20260714040000`. Prisma still applies them deterministically because the full names sort as `…_add_task_assignment` then `…_add_truck_inspection_time`. Future migrations must use **unique** timestamps (e.g. `20260714041000_…`) to avoid ambiguity for humans.

Provider lock: `migration_lock.toml` → `postgresql`.

---

## 4. Migration reproducibility

### Zero to applied (CI / new environment)

```bash
# 1. Provide DATABASE_URL for an empty PostgreSQL database
# 2. Deploy migrations (no interactive prompts)
pnpm --filter @nelna/api exec prisma migrate deploy

# 3. Confirm status
pnpm --filter @nelna/api exec prisma migrate status

# 4. Optional: seed reference data (idempotent)
pnpm --filter @nelna/api exec prisma db seed
```

### Developer (creates migrations)

```bash
pnpm --filter @nelna/api exec prisma migrate dev --name <short_snake_name>
```

Reproducibility check: apply the same migration set to two empty databases and confirm `_prisma_migrations` contents and table DDL match (`pg_dump --schema-only` diff).

---

## 5. New environment setup from zero

1. Provision PostgreSQL 14+ (recommended 16).
2. Create empty database (example: `nelna_fg`) and a least-privilege app role.
3. Set `DATABASE_URL` (and other vars from `.env.example`).
4. `prisma migrate deploy`
5. `prisma db seed` (only if seed user envs are configured intentionally)
6. Run API health / smoke tests

Do **not** use `prisma db push` in UAT or production; it bypasses migration history.

---

## 6. Seed idempotency

`apps/api/prisma/seed.ts` upserts by natural keys (codes, permission keys, role names, template codes, etc.). Running seed twice must not duplicate roles, departments, template versions, or vehicles.

**Validation:** after two consecutive seeds on a clean DB, row counts for permissions, roles, departments, and checklist templates must be unchanged; audit that template `versionNumber` uniqueness still holds.

Sample users are created only when both email and password env vars are present — no hard-coded production credentials.

---

## 7. Integrity rules verified against schema

### Unique constraints (quality-critical)

| Entity | Constraint | Why it matters |
|--------|------------|----------------|
| `ChecklistTemplateVersion` | `(templateId, versionNumber)` | Version identity |
| `InspectionResult` | `(recordId, itemId)` | One answer per item per record |
| `CorrectiveAction` | `resultId` unique | Submit idempotency / one CA per failed result |
| `TaskAssignment` | `(assignedToId, templateCode, dueDate)` | Duplicate daily task prevention |
| `Vehicle` | `vehicleNumber`, `freezerTruckNumber` | Duplicate vehicle prevention |
| Users / roles / permissions | email, employeeCode, role name, permission key | Access integrity |

### Foreign keys protecting history

| Edge | onDelete | Intent |
|------|----------|--------|
| `InspectionRecord` → `ChecklistTemplateVersion` | **Restrict** | Historical records keep their template version |
| `InspectionResult` → `ChecklistItem` | **Restrict** | Answers cannot orphan item definitions used historically |
| `InspectionRecord` → `createdBy` | **Restrict** | Recorder identity cannot vanish via user hard-delete |
| Draft template content (sections/items/options) | Cascade within draft tree | Safe rewrite of unpublished drafts only |
| `CorrectiveAction` → record/result | **SetNull** | CA can survive soft unlink; prefer status archive over delete |
| `AuditLog` → actor | **SetNull** | Audit rows retained if user removed |

### Indexes (ops / query)

Documented in init migration: record `(documentCode, recordDate)`, status, templateVersionId; CA status/priority; audit entity indexes; attachment record/result indexes; approval `(recordId, approvalType)`.

### Template-version integrity

- Records bind to **`templateVersionId`**, not “current template”.
- Publishing version 2 must not rewrite version 1 rows; historical records continue referencing version 1 (`onDelete: Restrict`).

### Approval / CA / attachment / audit

- Approvals cascade only if the **record row** is physically deleted (application must not hard-delete verified records; use `ARCHIVED` + `archivedAt`).
- Attachment metadata references record/result with Restrict on uploader.
- Audit log is append-oriented; actor FK is SetNull — deleting a user must not wipe audit history.

### Archive behaviour

Application model comment: verified records are never physically deleted; use `status = ARCHIVED` and `archivedAt`. Physical `DELETE` on `InspectionRecord` would cascade to results/attachments/approvals at the DB layer — **uncontrolled cascade risk if operators run raw SQL**. Controls:

1. No public “delete record” API for verified history.
2. Prefer archive.
3. DB role used by the API should lack `DELETE` on quality tables in hardened production (recommended ops hardening).

### Uncontrolled cascade — assessment

**Acceptable cascades:** draft template subtree; refresh tokens / notifications with user; child rows when a draft inspection is intentionally removed.

**Dangerous if misused:** hard-deleting an `InspectionRecord` cascades results, attachments, truck detail, approvals. Mitigation is application policy + restricted DB grants, not removing child FKs (orphans are worse for integrity).

---

## 8. Recommended test-data scenarios (for migrate/seed/UAT DB)

Populate (manually or via future fixture script) at least:

1. Daily cleaning pass  
2. Daily cleaning fail (one/multiple unacceptables)  
3. Truck pass  
4. Truck critical fail + loading block  
5. Returned correction + resubmit  
6. Supervisor check + QA verification rows (when workflow enabled)  
7. Corrective-action lifecycle (open → evidence → close)  
8. Template version 1 + version 2 published  
9. Historical record still pointing at version 1 after version 2 is current  

Use reconciliation queries in `DATA_RECONCILIATION.md` after backup/restore.

---

## 9. Rollback guidance

- Prefer **forward-fix** migrations.
- `prisma migrate resolve` only for failed migration bookkeeping after DBA review.
- Restoring a previous Postgres dump (see `BACKUP_RESTORE_RUNBOOK.md`) is the safe path for severe schema mistakes — not `migrate down` fiction.

---

## 10. Checklist before production cutover

- [ ] `prisma validate` clean  
- [ ] `migrate status` shows all applied  
- [ ] No pending uncommitted SQL drift vs schema  
- [ ] Seed run understood (or skipped if prod users provisioned elsewhere)  
- [ ] Backup taken **before** migrate deploy  
- [ ] Post-migrate smoke + count reconciliation  

---

*Developed for Nelna FG Digital Recording System · Maintained with Prompt 21*
