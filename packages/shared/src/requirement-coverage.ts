/**
 * Requirement coverage registry for NMS/PPU/CL/24 and NMS/PPU/CL/30.
 * Used by docs generation tests and audit gates — every source field must
 * resolve to implemented | partial | deferred | na.
 */
import { ALL_CLEANING_ITEMS, FREEZER_TRUCK_CHECK_ITEMS } from "./records";

export type CoverageStatus = "implemented" | "partial" | "deferred" | "na";

export type RequirementFieldCoverage = {
  documentCode: "NMS/PPU/CL/24" | "NMS/PPU/CL/30";
  sourceField: string;
  status: CoverageStatus;
  systemScreen: string;
  uiComponent: string;
  apiEndpoint: string;
  dbModel: string;
  dbField: string;
  validationRule: string;
  testReference: string;
  notes: string;
};

const CLEANING_ITEM_FIELDS: RequirementFieldCoverage[] = ALL_CLEANING_ITEMS.map((item) => ({
  documentCode: "NMS/PPU/CL/24",
  sourceField: `${item.area === "FINISHED_GOODS" ? "Finished Goods" : "Changing Room"} / ${item.label}`,
  status: "implemented",
  systemScreen: "/records/cleaning",
  uiComponent: "ChecklistRenderer / ChecklistItemCard",
  apiEndpoint: "POST|PATCH|GET /inspection-records/*",
  dbModel: "ChecklistItem + InspectionResult",
  dbField: "item code via seed; InspectionResult.status",
  validationRule: "Required Acceptable/Unacceptable; fail needs remark/evidence per item rules",
  testReference: "packages/shared/src/requirement-coverage.test.ts; checklist-engine.test.ts",
  notes: "Rendered dynamically from published template version NMS/PPU/CL/24.",
}));

const TRUCK_ITEM_FIELDS: RequirementFieldCoverage[] = FREEZER_TRUCK_CHECK_ITEMS.map((item) => ({
  documentCode: "NMS/PPU/CL/30",
  sourceField: item.label,
  status: "implemented",
  systemScreen: "/records/freezer-truck",
  uiComponent: "FreezerTruckForm / ChecklistRenderer",
  apiEndpoint: "POST|PATCH|GET /inspection-records/* ; POST .../loading-decision",
  dbModel: "ChecklistItem + InspectionResult",
  dbField: "InspectionResult.status",
  validationRule: "Required Pass/Fail/N/A; critical fail blocks loading",
  testReference: "truck-inspection.test.ts; FreezerTruckForm.test.tsx",
  notes: "Door, sealing, freezer unit, smell and contamination exist as seeded operational extras beyond the paper headline list — see OPEN_BUSINESS_DECISIONS.",
}));

export const REQUIREMENT_FIELD_COVERAGE: RequirementFieldCoverage[] = [
  ...CLEANING_ITEM_FIELDS,
  {
    documentCode: "NMS/PPU/CL/24",
    sourceField: "Date",
    status: "implemented",
    systemScreen: "/records/cleaning",
    uiComponent: "InspectionRecordWorkspace header",
    apiEndpoint: "InspectionRecordHeader.recordDate",
    dbModel: "InspectionRecord",
    dbField: "recordDate",
    validationRule: "YYYY-MM-DD; defaults to Asia/Colombo today",
    testReference: "operational-datetime.test.ts; inspection-records.service.spec.ts",
    notes: "Operational calendar uses Asia/Colombo.",
  },
  {
    documentCode: "NMS/PPU/CL/24",
    sourceField: "Month",
    status: "implemented",
    systemScreen: "/records/cleaning",
    uiComponent: "InspectionRecordWorkspace header (derived)",
    apiEndpoint: "InspectionRecordHeader.recordMonth",
    dbModel: "Derived from InspectionRecord.recordDate",
    dbField: "n/a (derived)",
    validationRule: "Derived month label from recordDate",
    testReference: "operational-datetime.test.ts; requirement-coverage.test.ts",
    notes: "Not a separate DB column — paper “Month” is presentation derived from Date. Confirm with Nelna if a separate auditable month is required.",
  },
  {
    documentCode: "NMS/PPU/CL/24",
    sourceField: "Recorded By",
    status: "implemented",
    systemScreen: "/records/cleaning",
    uiComponent: "InspectionRecordWorkspace header",
    apiEndpoint: "InspectionRecordHeader.recordedBy",
    dbModel: "InspectionRecord",
    dbField: "createdById → User",
    validationRule: "Auto from authenticated session; never free-typed",
    testReference: "inspection-records.service.spec.ts",
    notes: "Traceable user relation.",
  },
  {
    documentCode: "NMS/PPU/CL/24",
    sourceField: "Checked By",
    status: "deferred",
    systemScreen: "/records/cleaning (header ready)",
    uiComponent: "Header shows checkedBy when populated",
    apiEndpoint: "InspectionRecordHeader.checkedBy (workflow API deferred)",
    dbModel: "InspectionRecord",
    dbField: "checkedById, checkedAt",
    validationRule: "Schema ready; check transition endpoints not implemented",
    testReference: "requirement-coverage.test.ts",
    notes: "Schema + display hooks exist. Operator-facing Check action awaits Nelna workflow confirmation.",
  },
  {
    documentCode: "NMS/PPU/CL/24",
    sourceField: "Verified By",
    status: "deferred",
    systemScreen: "/records/cleaning (header ready)",
    uiComponent: "Header shows verifiedBy when populated",
    apiEndpoint: "InspectionRecordHeader.verifiedBy (workflow API deferred)",
    dbModel: "InspectionRecord",
    dbField: "verifiedById, verifiedAt",
    validationRule: "Schema ready; verify transition endpoints not implemented",
    testReference: "requirement-coverage.test.ts",
    notes: "Same as Checked By — deferred operational workflow, not inventing policy.",
  },
  {
    documentCode: "NMS/PPU/CL/24",
    sourceField: "Correction",
    status: "implemented",
    systemScreen: "/records/cleaning",
    uiComponent: "FailureDetailPanel (Correction)",
    apiEndpoint: "ChecklistItemResponse.correction",
    dbModel: "InspectionResult",
    dbField: "correction",
    validationRule: "Optional quick-choice immediate correction; distinct from Corrective Action",
    testReference: "requirement-coverage.test.ts; FailureDetailPanel",
    notes: "Separate concept from Corrective Action in DB, API and UI labels.",
  },
  {
    documentCode: "NMS/PPU/CL/24",
    sourceField: "Corrective Action",
    status: "partial",
    systemScreen: "/records/cleaning",
    uiComponent: "FailureDetailPanel (Corrective action)",
    apiEndpoint: "ChecklistItemResponse.correctiveAction + CorrectiveAction entity",
    dbModel: "InspectionResult.correctiveAction; CorrectiveAction",
    dbField: "correctiveAction / CorrectiveAction.*",
    validationRule: "Required when item.correctiveActionRequiredOnFail",
    testReference: "inspection-records.service.spec.ts",
    notes: "Currently required for critical cold-room items via seed rules. Whether every failure needs CA is an open Nelna decision.",
  },
  {
    documentCode: "NMS/PPU/CL/24",
    sourceField: "Acceptable",
    status: "implemented",
    systemScreen: "/records/cleaning",
    uiComponent: "SegmentedStatusSelector",
    apiEndpoint: "InspectionResult.status ACCEPTABLE",
    dbModel: "InspectionResult",
    dbField: "status",
    validationRule: "Acceptable/Unacceptable (N/A disabled in seed for CL/24)",
    testReference: "checklist-engine.test.ts",
    notes: "",
  },
  {
    documentCode: "NMS/PPU/CL/24",
    sourceField: "Unacceptable",
    status: "implemented",
    systemScreen: "/records/cleaning",
    uiComponent: "SegmentedStatusSelector + FailureDetailPanel",
    apiEndpoint: "InspectionResult.status UNACCEPTABLE",
    dbModel: "InspectionResult",
    dbField: "status + failure fields",
    validationRule: "Fail opens exception fields; remark/evidence per item rules",
    testReference: "checklist-engine.test.ts; InspectionRecordWorkspace.test.tsx",
    notes: "",
  },
  ...TRUCK_ITEM_FIELDS,
  {
    documentCode: "NMS/PPU/CL/30",
    sourceField: "Date",
    status: "implemented",
    systemScreen: "/records/freezer-truck",
    uiComponent: "FreezerTruckForm header",
    apiEndpoint: "InspectionRecordHeader.recordDate",
    dbModel: "InspectionRecord",
    dbField: "recordDate",
    validationRule: "Asia/Colombo date-of-record",
    testReference: "operational-datetime.test.ts",
    notes: "",
  },
  {
    documentCode: "NMS/PPU/CL/30",
    sourceField: "Time",
    status: "implemented",
    systemScreen: "/records/freezer-truck",
    uiComponent: "FreezerTruckForm header",
    apiEndpoint: "TruckInspectionDetailPayload.inspectionTime",
    dbModel: "TruckInspectionDetail",
    dbField: "inspectionTime",
    validationRule: "HH:mm Asia/Colombo captured at draft create",
    testReference: "operational-datetime.test.ts; requirement-coverage.test.ts",
    notes: "Auto-captured; operator does not type free-form clock time.",
  },
  {
    documentCode: "NMS/PPU/CL/30",
    sourceField: "Freezer Truck Number",
    status: "implemented",
    systemScreen: "/records/freezer-truck",
    uiComponent: "Vehicle selector / manual fallback",
    apiEndpoint: "POST /inspection-records/truck/draft",
    dbModel: "TruckInspectionDetail",
    dbField: "freezerTruckNumber",
    validationRule: "Required via vehicle or permitted manual entry",
    testReference: "FreezerTruckForm.test.tsx",
    notes: "",
  },
  {
    documentCode: "NMS/PPU/CL/30",
    sourceField: "Vehicle Number",
    status: "implemented",
    systemScreen: "/records/freezer-truck",
    uiComponent: "Vehicle selector / manual fallback",
    apiEndpoint: "POST /inspection-records/truck/draft ; GET /vehicles",
    dbModel: "TruckInspectionDetail / Vehicle",
    dbField: "vehicleNumber",
    validationRule: "Required",
    testReference: "vehicles.service.spec.ts",
    notes: "",
  },
  {
    documentCode: "NMS/PPU/CL/30",
    sourceField: "Corrective Action",
    status: "partial",
    systemScreen: "/records/freezer-truck",
    uiComponent: "FailureDetailPanel",
    apiEndpoint: "ChecklistItemResponse.correctiveAction + CorrectiveAction",
    dbModel: "InspectionResult / CorrectiveAction",
    dbField: "correctiveAction",
    validationRule: "Required when item rule demands it (critical checks in seed)",
    testReference: "inspection-records.service.spec.ts",
    notes: "docs/records.md wording vs seed policy is an open Nelna decision.",
  },
  {
    documentCode: "NMS/PPU/CL/30",
    sourceField: "Checked By",
    status: "deferred",
    systemScreen: "/records/freezer-truck (header ready)",
    uiComponent: "Header shows checkedBy when populated",
    apiEndpoint: "InspectionRecordHeader.checkedBy",
    dbModel: "InspectionRecord",
    dbField: "checkedById",
    validationRule: "Schema ready; Check workflow deferred",
    testReference: "requirement-coverage.test.ts",
    notes: "Loading decision uses decidedBy separately — not a substitute for Checked By until Nelna confirms.",
  },
  {
    documentCode: "NMS/PPU/CL/30",
    sourceField: "Verified By",
    status: "deferred",
    systemScreen: "/records/freezer-truck (header ready)",
    uiComponent: "Header shows verifiedBy when populated",
    apiEndpoint: "InspectionRecordHeader.verifiedBy",
    dbModel: "InspectionRecord",
    dbField: "verifiedById",
    validationRule: "Schema ready; Verify workflow deferred",
    testReference: "requirement-coverage.test.ts",
    notes: "",
  },
  {
    documentCode: "NMS/PPU/CL/30",
    sourceField: "Final Loading Decision",
    status: "implemented",
    systemScreen: "/records/freezer-truck",
    uiComponent: "Loading decision panel",
    apiEndpoint: "POST /inspection-records/:id/loading-decision",
    dbModel: "TruckInspectionDetail",
    dbField: "loadingDecision, recommendedDecision, decidedById",
    validationRule: "Critical failure cannot be approved; role-gated final decision",
    testReference: "truck-inspection.test.ts; inspection-records.service.spec.ts",
    notes: "AuditLog captures decision changes.",
  },
];

export function assertAllSourceFieldsCovered(): void {
  const missing = REQUIREMENT_FIELD_COVERAGE.filter((row) => !row.status);
  if (missing.length > 0) {
    throw new Error(`Unclassified requirement fields: ${missing.map((m) => m.sourceField).join(", ")}`);
  }
}

export function coverageSummary(): Record<CoverageStatus, number> {
  return REQUIREMENT_FIELD_COVERAGE.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { implemented: 0, partial: 0, deferred: 0, na: 0 } as Record<CoverageStatus, number>,
  );
}

/** Guards that Correction and Corrective Action remain separate concepts. */
export function correctionConceptsAreDistinct(): boolean {
  const correction = REQUIREMENT_FIELD_COVERAGE.find(
    (row) => row.documentCode === "NMS/PPU/CL/24" && row.sourceField === "Correction",
  );
  const corrective = REQUIREMENT_FIELD_COVERAGE.find(
    (row) => row.documentCode === "NMS/PPU/CL/24" && row.sourceField === "Corrective Action",
  );
  return Boolean(
    correction &&
      corrective &&
      correction.dbField !== corrective.dbField &&
      correction.uiComponent !== corrective.uiComponent,
  );
}
