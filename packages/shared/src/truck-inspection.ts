/**
 * Freezer Truck Inspection Before Loading (NMS/PPU/CL/30) — shared request/
 * response contracts and pure, framework-free helpers layered on top of the
 * generic `inspection-records.ts` workflow. Kept separate from that module
 * (rather than folding truck-only concepts into it) so the cleaning workflow
 * never has to reason about vehicles/loading decisions, mirroring the
 * relationship `inspection-records.ts` already has with `checklist-engine.ts`.
 * See docs/records.md and docs/CHECKLIST_ENGINE.md.
 */
import { z } from "zod";
import {
  detectCriticalFailures,
  isFailureResponse,
  type ChecklistItemDefinition,
  type ChecklistResponseMap,
} from "./checklist-engine";
import {
  FINAL_LOADING_DECISIONS,
  WORK_SHIFTS,
  type FinalLoadingDecision,
  type LoadingDecision,
} from "./records";

// ---------------------------------------------------------------------------
// Vehicle / driver / transporter — search + selection
// ---------------------------------------------------------------------------

export const VEHICLE_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export type TransporterSummary = {
  id: string;
  name: string;
};

export type DriverSummary = {
  id: string;
  fullName: string;
  licenseNumber: string;
  phone: string | null;
};

export type VehicleSummary = {
  id: string;
  vehicleNumber: string;
  freezerTruckNumber: string | null;
  status: VehicleStatus;
  transporter: TransporterSummary | null;
};

export type VehicleSearchResponse = {
  vehicles: VehicleSummary[];
  /** True when `vehicles` is the "recent vehicles" fallback (no search
   *  query supplied) rather than an actual text-match search result. */
  isRecent: boolean;
};

// ---------------------------------------------------------------------------
// Wire schemas (API request bodies)
// ---------------------------------------------------------------------------

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Starts (or resumes) a Freezer Truck Inspection draft. Either `vehicleId`
 * (selected from the searchable vehicle picker) or both `freezerTruckNumber`
 * + `vehicleNumber` (the manual fallback, gated by `vehicles:manual_entry`
 * server-side) must be supplied.
 */
export const createTruckDraftSchema = z
  .object({
    recordDate: z
      .string()
      .regex(YYYY_MM_DD, "recordDate must be in YYYY-MM-DD format")
      .optional(),
    shiftCode: z.enum(WORK_SHIFTS).optional(),
    areaLabel: z.string().trim().min(1).max(200).optional(),
    vehicleId: z.string().trim().min(1).optional(),
    freezerTruckNumber: z.string().trim().min(1).max(50).optional(),
    vehicleNumber: z.string().trim().min(1).max(50).optional(),
    driverId: z.string().trim().min(1).optional(),
    transporterId: z.string().trim().min(1).optional(),
    loadingReference: z.string().trim().max(100).optional(),
    productCategory: z.string().trim().max(100).optional(),
    taskAssignmentId: z.string().trim().min(1).optional(),
    /** Links this draft back to a prior blocked/rejected inspection of the
     *  same truck, so the two remain traceably linked as a re-inspection. */
    reinspectionOfRecordId: z.string().trim().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.vehicleId && !(data.freezerTruckNumber && data.vehicleNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a vehicle, or enter freezer truck and vehicle numbers manually",
        path: ["vehicleId"],
      });
    }
  });
export type CreateTruckDraftInput = z.infer<typeof createTruckDraftSchema>;

/** Body for the role-gated final loading-decision approval endpoint. */
export const loadingDecisionInputSchema = z.object({
  decision: z.enum(FINAL_LOADING_DECISIONS),
  remarks: z.string().trim().max(2000).optional(),
});
export type LoadingDecisionInput = z.infer<typeof loadingDecisionInputSchema>;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export type TemperatureReading = {
  current: number | null;
  min: number | null;
  max: number | null;
  acceptable: boolean | null;
};

export type ReinspectionLink = {
  recordId: string;
  recordNumber: string;
};

export type TruckInspectionDetailPayload = {
  vehicle: VehicleSummary | null;
  driver: DriverSummary | null;
  transporter: TransporterSummary | null;
  freezerTruckNumber: string;
  vehicleNumber: string;
  /** Inspection clock time (HH:mm) in Asia/Colombo, captured at draft create. */
  inspectionTime: string | null;
  loadingReference: string | null;
  productCategory: string | null;
  temperature: TemperatureReading;
  /** The system-computed recommendation captured at operator-submit time —
   *  never changes afterwards, even once a final decision is recorded. */
  recommendedDecision: LoadingDecision | null;
  /** Current/final decision — starts equal to `recommendedDecision` on
   *  submit, then only changes via the loading-decision approval endpoint. */
  loadingDecision: LoadingDecision;
  decidedBy: { id: string; fullName: string; employeeCode: string } | null;
  decidedAt: string | null;
  remarks: string | null;
  /** Set when this record is a re-inspection of a prior blocked/rejected one. */
  reinspectionOf: ReinspectionLink | null;
};

// ---------------------------------------------------------------------------
// Loading decision calculation — the shared "helper" both API and web use
// ---------------------------------------------------------------------------

export type LoadingDecisionCalculation = {
  decision: LoadingDecision;
  hasCriticalFailure: boolean;
  hasAnyFailure: boolean;
  criticalFailureItemIds: string[];
};

/**
 * Computes the *recommended* final loading decision from a freezer truck
 * inspection's current responses — the single source of truth for the
 * "critical failure automatically blocks loading" business rule:
 *
 * - Any critical-failure item currently failing → `LOADING_BLOCKED`,
 *   regardless of how many other items pass. This can never be computed as
 *   an "approved" outcome — see `isOverrideToApprovedAllowed`.
 * - Any other (non-critical) failure → `CONDITIONALLY_APPROVED`, the
 *   "may load with a documented exception" outcome.
 * - Every item passing (or N/A) → `APPROVED_FOR_LOADING`.
 *
 * Pure and framework-free so the API (on submit) and the web review screen
 * (live preview before submit) can never compute a different answer from
 * the same responses.
 */
export function computeRecommendedLoadingDecision(
  items: ChecklistItemDefinition[],
  responses: ChecklistResponseMap,
): LoadingDecisionCalculation {
  const criticalFailures = detectCriticalFailures(items, responses);
  const hasCriticalFailure = criticalFailures.length > 0;
  const hasAnyFailure = items.some((item) => isFailureResponse(item, responses[item.id]));

  const decision: LoadingDecision = hasCriticalFailure
    ? "LOADING_BLOCKED"
    : hasAnyFailure
      ? "CONDITIONALLY_APPROVED"
      : "APPROVED_FOR_LOADING";

  return {
    decision,
    hasCriticalFailure,
    hasAnyFailure,
    criticalFailureItemIds: criticalFailures.map((item) => item.id),
  };
}

/** A critical-failure recommendation is a hard block: no human — operator,
 *  supervisor, or QA — may record an "approved" final decision while it
 *  stands. Only `LOADING_BLOCKED` (leave it blocked) or `REJECTED` (reject
 *  the truck outright) are valid final decisions in that case. */
export function isOverrideToApprovedAllowed(
  recommendedDecision: LoadingDecision | null,
): boolean {
  return recommendedDecision !== "LOADING_BLOCKED";
}

/** Every final decision a supervisor/QA may legally record given the
 *  system's recommendation — enforces the same non-overridable-block rule
 *  as `isOverrideToApprovedAllowed`, expressed as an allow-list for the API
 *  layer and the web decision picker to share. */
export function allowedFinalDecisions(
  recommendedDecision: LoadingDecision | null,
): readonly FinalLoadingDecision[] {
  if (isOverrideToApprovedAllowed(recommendedDecision)) {
    return FINAL_LOADING_DECISIONS;
  }
  return ["LOADING_BLOCKED", "REJECTED"];
}
