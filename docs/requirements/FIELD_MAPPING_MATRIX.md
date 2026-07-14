# Field mapping matrix — NMS/PPU/CL/24 & NMS/PPU/CL/30

**Machine-readable source of truth:** `packages/shared/src/requirement-coverage.ts`  
**Guard tests:** `packages/shared/src/requirement-coverage.test.ts`

Columns (as required): Source document · Document code · Source field · System screen · UI component · API endpoint · Request/response field · Database model · Database field · Validation rule · Required/optional · User role · Workflow stage · Report/PDF location · Test case reference · Implementation status · Notes / approved deviation

> Report/PDF location: **deferred** — PDF rendering is not yet implemented; matrices record `PDF_DEFERRED` so reports cannot invent a false location. When PDFs land they must consume the same `InspectionRecord` / `InspectionResult` / `TruckInspectionDetail` payload (no parallel data path).

## NMS/PPU/CL/24 — Daily Cleaning Verification

| Source field | Screen | UI | API / DTO | DB | Validation | Req | Role / stage | Report/PDF | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FG Wall…Cold Room 2 (8 items) | `/records/cleaning` | ChecklistItemCard | responses map | ChecklistItem + InspectionResult | Required Acceptable/Unacceptable | Required | Operator DRAFT→SUBMITTED | PDF_DEFERRED | checklist-engine / workspace tests | implemented | Seeded Finished Goods section |
| CR Wall, Floor, Locker | `/records/cleaning` | ChecklistItemCard | responses map | same | Required | Required | Operator | PDF_DEFERRED | same | implemented | Seeded Changing Room section |
| Date | cleaning header | HeaderField | `header.recordDate` | InspectionRecord.recordDate | YYYY-MM-DD Asia/Colombo | Required (auto) | Operator create | PDF_DEFERRED | operational-datetime | implemented | |
| Month | cleaning header | HeaderField | `header.recordMonth` | derived | Derived from Date | Derived | Display | PDF_DEFERRED | operational-datetime | implemented | Not a separate column; open decision if auditable month needed |
| Recorded By | cleaning header | HeaderField | `header.recordedBy` | createdById→User | Session user | Required (auto) | Operator | PDF_DEFERRED | service specs | implemented | Never free-typed |
| Checked By | cleaning header | HeaderField | `header.checkedBy` | checkedById | Deferred workflow | Deferred | Supervisor check | PDF_DEFERRED | requirement-coverage | deferred | Schema + display ready |
| Verified By | cleaning header | HeaderField | `header.verifiedBy` | verifiedById | Deferred workflow | Deferred | QA verify | PDF_DEFERRED | requirement-coverage | deferred | Schema + display ready |
| Correction | failure panel | FailureDetailPanel | `correction` | InspectionResult.correction | Optional quick choice | Optional | On fail | PDF_DEFERRED | requirement-coverage | implemented | Distinct from Corrective Action |
| Corrective Action | failure panel | FailureDetailPanel | `correctiveAction` + entity | InspectionResult + CorrectiveAction | Required when item rule set | Conditional | On fail / CA workflow | PDF_DEFERRED | service specs | partial | Seed requires for critical cold rooms |
| Acceptable / Unacceptable | item card | SegmentedStatusSelector | ResultStatus | InspectionResult.status | Required | Required | Draft/submit | PDF_DEFERRED | checklist-engine | implemented | |

## NMS/PPU/CL/30 — Freezer Truck Before Loading

| Source field | Screen | UI | API / DTO | DB | Validation | Req | Role / stage | Report/PDF | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cleanliness, Pallets, Floor, Side Walls, Curtains, Door Lock, Insects/Signs | `/records/freezer-truck` | ChecklistRenderer | responses | ChecklistItem + InspectionResult | Pass/Fail/N/A; critical rules | Required | Operator | PDF_DEFERRED | truck-inspection tests | implemented | Extra seeded operational checks also exist |
| Date | truck header | HeaderField | `header.recordDate` | recordDate | Asia/Colombo | Auto | Operator | PDF_DEFERRED | operational-datetime | implemented | |
| Time | truck header | HeaderField | `truck.inspectionTime` | TruckInspectionDetail.inspectionTime | HH:mm Colombo | Auto | Operator draft | PDF_DEFERRED | operational-datetime | implemented | Auto at draft create |
| Freezer Truck Number | vehicle UI | selector/manual | draft body | truckDetail.freezerTruckNumber | Required | Required | Operator | PDF_DEFERRED | FreezerTruckForm tests | implemented | |
| Vehicle Number | vehicle UI | selector/manual | draft body | truckDetail.vehicleNumber | Required | Required | Operator | PDF_DEFERRED | vehicles tests | implemented | |
| Corrective Action | failure panel | FailureDetailPanel | correctiveAction | InspectionResult / CorrectiveAction | Conditional | Conditional | On fail | PDF_DEFERRED | service specs | partial | Open CA-on-any-fail decision |
| Checked By | truck header | HeaderField | `header.checkedBy` | checkedById | Deferred | Deferred | Check stage | PDF_DEFERRED | requirement-coverage | deferred | Not replaced by decidedBy |
| Verified By | truck header | HeaderField | `header.verifiedBy` | verifiedById | Deferred | Deferred | Verify stage | PDF_DEFERRED | requirement-coverage | deferred | |
| Final Loading Decision | decision panel | Loading decision UI | POST `.../loading-decision` | loadingDecision, recommendedDecision, decidedById | Critical block cannot approve | Required for dispatch | Supervisor/QA/FSTL/Admin | PDF_DEFERRED | truck-inspection + service | implemented | AuditLog on change |

## Regenerating this matrix

Update `REQUIREMENT_FIELD_COVERAGE` first, keep tests green, then refresh this document to match. Do not let docs and registry diverge.
