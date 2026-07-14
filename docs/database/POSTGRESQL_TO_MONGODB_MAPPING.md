# PostgreSQL → MongoDB Mapping — Nelna FG Digital Recording System

**Branch:** `feature/mongodb-atlas-migration`  
**Baseline SHA:** `33c3ebc`  
**Target DB:** `fg_online`  
**ID strategy:** `String @id @default(auto()) @map("_id") @db.ObjectId`  
**Date-only strategy:** `DateTime` UTC midnight (remove `@db.Date`)  
**Migration status column (this audit):** `PLANNED` until schema conversion lands

Legend for **Migration status:** `PLANNED` | `IN_PROGRESS` | `CONVERTED` | `SEEDED` | `RECONCILED` | `BLOCKED`

---

## 1. Enum mapping

All 14 Prisma enums stay as Prisma enums; Mongo stores string values.

| Enum | Notes |
|------|-------|
| UserStatus, RecordStatus, ResultStatus, ApprovalType, ApprovalDecision | Unchanged semantics |
| CorrectiveActionStatus, Priority, VehicleStatus, LoadingDecisionStatus | Unchanged |
| TemplateStatus, AttachmentKind, ChecklistItemType, NotificationType, TaskAssignmentStatus | Unchanged |

**Risk:** Low — app validation already primary.  
**Test coverage:** Shared + API workflow specs (existing).

---

## 2. Model ↔ collection matrix

### users ← `User` / table `User`

| Aspect | Detail |
|--------|--------|
| Target collection | `users` (`@@map("users")`) |
| Existing ID | `cuid` String |
| Target ID | ObjectId |
| Uniques | `employeeCode`; `email` (nullable — **sparse unique**) |
| Indexes | `status` |
| Relations | departmentId, sectionId → ObjectId; many back-rels |
| PG-only | none |
| Transform | cuid→ObjectId map on import |
| Risk | Medium (nullable email unique) |
| Tests | users.service.spec, auth |
| Status | PLANNED |

### roles ← `Role`

| Aspect | Detail |
|--------|--------|
| Collection | `roles` |
| Uniques | `name` |
| Risk | Low |
| Status | PLANNED |

### permissions ← `Permission`

| Aspect | Detail |
|--------|--------|
| Collection | `permissions` |
| Uniques | `key` |
| Risk | Low |
| Status | PLANNED |

### userRoles ← `UserRole`

| Aspect | Detail |
|--------|--------|
| Collection | `userRoles` |
| Existing ID | **Composite PK** `(userId, roleId)` |
| Target ID | New ObjectId `_id` + `@@unique([userId, roleId])` |
| Indexes | `roleId` |
| Relations | user Cascade → **app cascade**; role Restrict → **app Restrict** |
| Risk | **High** (composite PK redesign) |
| Tests | seed idempotency, role assignment |
| Status | PLANNED |

### rolePermissions ← `RolePermission`

| Aspect | Detail |
|--------|--------|
| Collection | `rolePermissions` |
| Existing ID | Composite `(roleId, permissionId)` |
| Target ID | ObjectId + `@@unique([roleId, permissionId])` |
| Relations | role Cascade / permission Restrict → app |
| Risk | **High** |
| Status | PLANNED |

### refreshTokens ← `RefreshToken`

| Aspect | Detail |
|--------|--------|
| Collection | `refreshTokens` |
| Uniques | `tokenHash` |
| Indexes | `userId`, `expiresAt` |
| Relations | user Cascade → app |
| Note | `replacedByTokenId` stays scalar (no FK today) |
| Risk | Medium (security-sensitive) |
| Status | PLANNED |

### departments ← `Department`

| Aspect | Detail |
|--------|--------|
| Collection | `departments` |
| Uniques | `name`, `code` |
| Risk | Low |
| Status | PLANNED |

### sections ← `Section`

| Aspect | Detail |
|--------|--------|
| Collection | `sections` |
| Uniques | `code`; **`@@unique([departmentId, name])`** |
| Relations | department Restrict → app |
| Risk | Medium (compound unique) |
| Status | PLANNED |

### shifts ← `Shift`

| Aspect | Detail |
|--------|--------|
| Collection | `shifts` |
| Uniques | `name`, `code` |
| Note | `startTime`/`endTime` already String |
| Risk | Low |
| Status | PLANNED |

### checklistTemplates ← `ChecklistTemplate`

| Aspect | Detail |
|--------|--------|
| Collection | `checklistTemplates` |
| Uniques | `code`, `currentVersionId` |
| Relations | currentVersion SetNull; createdBy SetNull |
| Risk | Medium (1:1 current version) |
| Status | PLANNED |

### checklistTemplateVersions ← `ChecklistTemplateVersion`

| Aspect | Detail |
|--------|--------|
| Collection | `checklistTemplateVersions` |
| Uniques | `@@unique([templateId, versionNumber])` |
| Indexes | `[templateId, status]` |
| Relations | template Restrict → app |
| Risk | Medium |
| Tests | checklist-templates + db immutability |
| Status | PLANNED |

### checklistSections ← `ChecklistSection`

| Aspect | Detail |
|--------|--------|
| Collection | `checklistSections` |
| Uniques | `[templateVersionId, sortOrder]` |
| Relations | version Cascade → app cascade on version delete (rare) |
| Risk | Medium |
| Status | PLANNED |

### checklistItems ← `ChecklistItem`

| Aspect | Detail |
|--------|--------|
| Collection | `checklistItems` |
| Uniques | `[sectionId, sortOrder]` |
| Fields | Float min/max OK as double |
| Risk | Medium |
| Status | PLANNED |

### checklistItemOptions ← `ChecklistItemOption`

| Aspect | Detail |
|--------|--------|
| Collection | `checklistItemOptions` |
| Uniques | `[itemId, value]` |
| Risk | Low–Medium |
| Status | PLANNED |

### taskAssignments ← `TaskAssignment`

| Aspect | Detail |
|--------|--------|
| Collection | `taskAssignments` |
| Uniques | `recordId`; **`@@unique([assignedToId, templateCode, dueDate])`** |
| Indexes | `[assignedToId, dueDate]` |
| PG-only | `dueDate @db.Date` → DateTime UTC midnight |
| Relations | assignedTo Cascade → app |
| Risk | **High** (3-field unique + date encoding) |
| Tests | tasks + seed compound upsert |
| Status | PLANNED |

### inspectionRecords ← `InspectionRecord`

| Aspect | Detail |
|--------|--------|
| Collection | `inspectionRecords` |
| Indexes | `[documentCode, recordDate]`, `status`, `templateVersionId`, `reinspectionOfId` |
| PG-only | `recordDate @db.Date` → DateTime UTC midnight |
| Self-relation | `reinspectionOfId` / `reinspections` |
| Relations | templateVersion Restrict; createdBy Restrict; check/verify SetNull |
| Risk | **High** (core workflow + self-rel + Restrict) |
| Tests | inspection-records, workflow, truck |
| Status | PLANNED |

### inspectionResults ← `InspectionResult`

| Aspect | Detail |
|--------|--------|
| Collection | `inspectionResults` |
| Uniques | `[recordId, itemId]` |
| Indexes | `[itemId, status]` |
| Relations | record Cascade; item Restrict |
| Risk | Medium |
| Status | PLANNED |

### inspectionAttachments ← `InspectionAttachment`

| Aspect | Detail |
|--------|--------|
| Collection | `inspectionAttachments` |
| Indexes | `recordId`, `resultId` |
| Metadata fields | recordId, resultId, kind, fileName, fileUrl/storage key, mimeType, size, hash (add if missing), uploadedBy, uploadedAt |
| Binary | **Not GridFS by default** — metadata only in Mongo |
| Risk | Medium (URL/storage semantics) |
| Status | PLANNED |

### approvalRecords ← `ApprovalRecord`

| Aspect | Detail |
|--------|--------|
| Collection | `approvalRecords` |
| Indexes | `[recordId, approvalType]` |
| Relations | record Cascade |
| Risk | Low–Medium |
| Status | PLANNED |

### correctiveActions ← `CorrectiveAction`

| Aspect | Detail |
|--------|--------|
| Collection | `correctiveActions` |
| Uniques | `@@unique([resultId])` nullable — **sparse** |
| Indexes | `[status, priority]`, `[assignedToId, status]` |
| Risk | Medium (nullable unique + incomplete CA product) |
| Status | PLANNED |

### correctiveActionEvidence ← `CorrectiveActionEvidence`

| Aspect | Detail |
|--------|--------|
| Collection | `correctiveActionEvidence` |
| Indexes | `correctiveActionId` |
| Risk | Low–Medium |
| Status | PLANNED |

### transporters ← `Transporter`

| Collection | `transporters` | Uniques `name` | Risk Low | Status PLANNED |

### vehicles ← `Vehicle`

| Aspect | Detail |
|--------|--------|
| Collection | `vehicles` |
| Uniques | `vehicleNumber`, `freezerTruckNumber`, `qrIdentifier` (nullable care) |
| Risk | Medium |
| Status | PLANNED |

### drivers ← `Driver`

| Collection | `drivers` | Unique `licenseNumber` | Status PLANNED |

### truckInspectionDetails ← `TruckInspectionDetail`

| Aspect | Detail |
|--------|--------|
| Collection | `truckInspectionDetails` |
| Uniques | `recordId` (1:1) |
| Relations | record Cascade; vehicle/driver/transporter/decidedBy SetNull |
| Risk | Medium (loading decisions) |
| Tests | truck-inspection shared + API |
| Status | PLANNED |

### failureReasons ← `FailureReason`

| Collection | `failureReasons` | Unique `code` | Status PLANNED |

### correctiveActionCategories ← `CorrectiveActionCategory`

| Collection | `correctiveActionCategories` | Unique `code` | Status PLANNED |

### temperatureProfiles ← `TemperatureProfile`

| Collection | `temperatureProfiles` | Unique `code`; Float mins/maxes | Status PLANNED |

### loadingDecisionPolicies ← `LoadingDecisionPolicy`

| Aspect | Detail |
|--------|--------|
| Collection | `loadingDecisionPolicies` |
| Uniques | `key` |
| Fields | `config Json` → BSON |
| Risk | Low |
| Status | PLANNED |

### notifications ← `Notification`

| Aspect | Detail |
|--------|--------|
| Collection | `notifications` |
| Indexes | `[userId, isRead]`, `createdAt` |
| Relations | user Cascade → app |
| Risk | Low |
| Status | PLANNED |

### auditLogs ← `AuditLog`

| Aspect | Detail |
|--------|--------|
| Collection | `auditLogs` |
| Indexes | `[entityType, entityId]`, `createdAt` |
| Fields | `metadata Json?` |
| Relations | actor SetNull |
| Risk | Low (append-heavy) |
| Status | PLANNED |

### systemSettings

| Aspect | Detail |
|--------|--------|
| Collection | `systemSettings` |
| Status | **NOT IN CURRENT SCHEMA** — do not create empty collection until a real model exists |

---

## 3. Constraint loss / compensation matrix

| PostgreSQL behaviour | Mongo representation | App enforcement required? |
|----------------------|----------------------|---------------------------|
| FK Restrict on template version / checklist item / createdBy | No FK | **Yes** — pre-delete checks |
| FK Cascade trees | No FK | **Yes** — or soft-delete only |
| FK SetNull | No FK | Prefer explicit updates |
| `@db.Date` equality in unique | DateTime midnight | **Yes** — normalize writes |
| Multiple NULL in unique | Sparse unique / partial | **Yes** if sparse unavailable |
| Composite PK join tables | Surrogate id + unique pair | Indexes only |
| Enum type | String | Zod/Prisma enum |

---

## 4. Data transformation rules (if PG export exists)

| Source | Target |
|--------|--------|
| `id` cuid | New ObjectId; store map `legacyId → objectId` |
| FK columns | Remap via legacy map |
| `recordDate` / `dueDate` date | `Date` UTC `YYYY-MM-DDT00:00:00.000Z` |
| Enums | Same string labels |
| `Json` | BSON document |
| Booleans / DateTimes | Direct |
| Attachment `fileUrl` | Preserve string; do not rewrite to public URL |
| Password hashes | Preserve bcrypt hashes unchanged |
| Refresh tokens | Prefer **not** migrating active sessions (force re-login) |

---

## 5. Test coverage map

| Area | Existing | Mongo gap to add |
|------|----------|------------------|
| Connection / ping | `SELECT 1` | Mongo ping |
| Seed idempotency | Partial | Explicit second-run test |
| Compound uniques | db-constraints | Recreate against Mongo |
| Restrict delete | db-integration | App-level tests |
| Workflow / truck / auth | Strong unit | Keep; add integration against `fg_online_test` |
| Concurrent submit | Transaction tests | Verify on Atlas replica set |
| Reports | Unit with mocks | Optional live query smoke |

---

## 6. Migration status roll-up (audit time)

| Category | Count | Status |
|----------|------:|--------|
| Models to convert | 31 | PLANNED |
| Join tables needing surrogate PK | 2 | PLANNED |
| Collections named | 31 (+ optional systemSettings later) | PLANNED |
| Data reconciliation | — | NOT_STARTED |
| GridFS | — | NOT_APPLICABLE (deferred) |

Update this table during conversion; do not mark RECONCILED without evidence documents.
