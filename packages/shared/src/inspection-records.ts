/**
 * Daily Cleaning Verification (and, generically, any dynamic-checklist)
 * record workflow — shared request/response contracts and pure,
 * framework-free helpers used by both the API (`inspection-records` module)
 * and the web app (record workspace + record detail view). Mirrors the
 * relationship `checklist-engine.ts` already has with the template CRUD
 * layer: business rules live here once, so the API and web app can never
 * silently drift apart. See docs/records.md.
 */
import { z } from "zod";
import {
  classifyResponseStatus,
  type ChecklistItemDefinition,
  type ChecklistResponseMap,
  type ChecklistTemplateVersionDefinition,
} from "./checklist-engine";
import {
  RECORD_STATUSES,
  WORK_SHIFTS,
  type LoadingDecision,
  type RecordStatus,
  type WorkShift,
} from "./records";
import type { UserRole } from "./roles";
import type { TruckInspectionDetailPayload } from "./truck-inspection";
import { resolveDraftDuplicateUnderPolicy } from "./draft-deduplication-strategy";

// ---------------------------------------------------------------------------
// Wire schemas (API request bodies / web form payloads)
// ---------------------------------------------------------------------------

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const DATA_URL_IMAGE_PATTERN =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Evidence is currently persisted as a data URL rather than an object-storage
 * reference. Accept only supported image MIME types and enforce a decoded
 * per-file size cap before the API reaches the persistence layer.
 */
const evidenceAttachmentSchema = z.object({
  id: z.string().min(1).max(200),
  url: z
    .string()
    .max(Math.ceil((MAX_EVIDENCE_BYTES * 4) / 3) + 128)
    .regex(
      DATA_URL_IMAGE_PATTERN,
      "Evidence must be a base64 JPEG, PNG, or WebP data URL.",
    )
    .refine(
      (url) => {
        const base64 = url.slice(url.indexOf(",") + 1);
        const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
        return (base64.length * 3) / 4 - padding <= MAX_EVIDENCE_BYTES;
      },
      `Evidence image must not exceed ${MAX_EVIDENCE_BYTES / (1024 * 1024)} MiB.`,
    ),
  fileName: z.string().trim().min(1).max(255),
  capturedAt: z.string().datetime(),
});

export const createCleaningDraftSchema = z.object({
  /** Calendar date the cleaning verification covers, `YYYY-MM-DD`. Defaults to today. */
  recordDate: z
    .string()
    .regex(YYYY_MM_DD, "recordDate must be in YYYY-MM-DD format")
    .optional(),
  shiftCode: z.enum(WORK_SHIFTS).optional(),
  areaLabel: z.string().trim().min(1).max(200).optional(),
  /** When starting from a "Today's Tasks" card, links the created/resumed
   *  record back to the originating TaskAssignment. */
  taskAssignmentId: z.string().trim().min(1).optional(),
});
export type CreateCleaningDraftInput = z.infer<typeof createCleaningDraftSchema>;

const checklistItemValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("status"),
    value: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]),
  }),
  z.object({ kind: z.literal("text"), value: z.string().max(2000) }),
  z.object({ kind: z.literal("number"), value: z.number() }),
  z.object({ kind: z.literal("date"), value: z.string() }),
  z.object({ kind: z.literal("time"), value: z.string() }),
  z.object({ kind: z.literal("select"), value: z.string() }),
  z.object({
    kind: z.literal("photo"),
    value: z.array(evidenceAttachmentSchema).max(4),
  }),
  z.object({
    kind: z.literal("signature"),
    value: z.object({ signedByName: z.string(), signedAt: z.string() }),
  }),
]);

export const checklistItemResponseSchema = z.object({
  itemId: z.string().min(1),
  value: checklistItemValueSchema.nullable(),
  remark: z.string().max(2000).optional(),
  issueReason: z.string().max(200).optional(),
  correction: z.string().max(200).optional(),
  correctiveAction: z.string().max(2000).optional(),
  evidence: z.array(evidenceAttachmentSchema).max(4).optional(),
});

export const saveDraftResponsesSchema = z.object({
  responses: z.record(checklistItemResponseSchema),
  areaLabel: z.string().trim().min(1).max(200).optional(),
});
export type SaveDraftResponsesInput = z.infer<typeof saveDraftResponsesSchema>;

export const submitInspectionRecordSchema = z.object({
  responses: z.record(checklistItemResponseSchema).optional(),
});
export type SubmitInspectionRecordInput = z.infer<typeof submitInspectionRecordSchema>;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export type InspectionActorSummary = {
  id: string;
  fullName: string;
  employeeCode: string;
};

export type InspectionRecordHeader = {
  id: string;
  documentCode: string;
  /** Human-readable identifier derived from the document code, record date
   *  and record id — see `formatRecordNumber`. Not a separate DB column. */
  recordNumber: string;
  templateTitle: string;
  templateVersionNumber: number;
  status: RecordStatus;
  /** `YYYY-MM-DD` operational calendar date (Asia/Colombo). */
  recordDate: string;
  /** Derived month label for paper-form parity (e.g. "July 2026"). */
  recordMonth: string;
  shiftLabel: string | null;
  areaLabel: string | null;
  recordedBy: InspectionActorSummary;
  /** Populated once a Check workflow transition records an actor (deferred). */
  checkedBy: InspectionActorSummary | null;
  /** Populated once a Verify workflow transition records an actor (deferred). */
  verifiedBy: InspectionActorSummary | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  checkedAt: string | null;
  verifiedAt: string | null;
};

export type InspectionRecordDetail = {
  header: InspectionRecordHeader;
  version: ChecklistTemplateVersionDefinition;
  responses: ChecklistResponseMap;
  /** True while the current user may still change responses (DRAFT, or
   *  REJECTED via the returned-correction workflow) — see `isRecordEditable`. */
  editable: boolean;
  /** Present only for freezer-truck-before-loading records (NMS/PPU/CL/30);
   *  `null` for every other document code, e.g. Daily Cleaning Verification. */
  truck: TruckInspectionDetailPayload | null;
};

export type RecordCounts = {
  acceptable: number;
  failed: number;
  notApplicable: number;
  unanswered: number;
  total: number;
};

export type SubmitRecordResult = {
  recordId: string;
  documentCode: string;
  recordNumber: string;
  status: RecordStatus;
  submittedAt: string;
  counts: RecordCounts;
  hasCriticalFailure: boolean;
  correctiveActionsCreated: number;
  nextResponsibleRole: UserRole | null;
  /** The freshly-computed recommended loading decision for a freezer truck
   *  inspection; `null` for every other document code. */
  loadingDecision: LoadingDecision | null;
};

// ---------------------------------------------------------------------------
// Pure helpers — record number, editability, duplicate prevention, counts
// ---------------------------------------------------------------------------

/** Deterministic, human-readable identifier for a record. Not stored as its
 *  own column — always derivable from `documentCode` + `recordDate` + `id`,
 *  so it can never drift out of sync with the underlying record. */
export function formatRecordNumber(
  documentCode: string,
  recordDate: string,
  id: string,
): string {
  const compactDate = recordDate.replace(/-/g, "");
  return `${documentCode}/${compactDate}/${id.slice(-6).toUpperCase()}`;
}

/** Statuses in which the operator who created the record may still change
 *  responses — see the "submission locks operator editing except the
 *  returned-correction workflow" business rule. */
const EDITABLE_STATUSES: readonly RecordStatus[] = [
  "DRAFT",
  "REJECTED",
  "RETURNED_FOR_CORRECTION",
];
export function isRecordEditable(status: RecordStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/** Statuses that already represent a completed submission for this
 *  date/shift/area — a second concurrent record must never be created while
 *  one of these is active. */
const ACTIVE_BLOCKING_STATUSES: readonly RecordStatus[] = [
  "SUBMITTED",
  "PENDING_CHECK",
  "CHECKED",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "COMPLETED",
  "RESUBMITTED",
];
export function isActiveBlockingStatus(status: RecordStatus): boolean {
  return ACTIVE_BLOCKING_STATUSES.includes(status);
}

/** Who is expected to act next once a record reaches `status` — surfaced on
 *  the post-submit success screen. Permission-configurable in API; labels are hints. */
export function nextResponsibleRoleForStatus(status: RecordStatus): UserRole | null {
  switch (status) {
    case "SUBMITTED":
    case "PENDING_CHECK":
    case "RESUBMITTED":
      return "FG_SUPERVISOR";
    case "CHECKED":
    case "PENDING_VERIFICATION":
      return "QA_EXECUTIVE";
    case "REJECTED":
    case "RETURNED_FOR_CORRECTION":
      return "FG_OPERATOR";
    case "DRAFT":
    case "VERIFIED":
    case "COMPLETED":
    case "ARCHIVED":
      return null;
    default:
      return null;
  }
}

export type ExistingActiveRecordCheck = {
  id: string;
  status: RecordStatus;
  createdById: string;
};

export type DuplicateResolution =
  | { outcome: "create" }
  | { outcome: "resume"; recordId: string }
  | { outcome: "conflict"; reason: string };

/**
 * Duplicate-prevention decision for "create/resume a draft for date + shift
 * + area". Delegates ARCHIVED/REJECTED handling to the named FG-DB-001 strategy
 * (`resolveDraftDuplicateUnderPolicy` + TECHNICAL_DEFAULT_DRAFT_REUSE_POLICY).
 */
export function resolveDraftDuplicate(
  existing: ExistingActiveRecordCheck | null,
  requesterId: string,
): DuplicateResolution {
  return resolveDraftDuplicateUnderPolicy(existing, requesterId);
}

/** Tallies every item in `items` against `responses` into the
 *  acceptable/failed/N-A/unanswered counts shown on the review screen and
 *  the post-submit success screen. */
export function computeRecordCounts(
  items: ChecklistItemDefinition[],
  responses: ChecklistResponseMap,
): RecordCounts {
  let acceptable = 0;
  let failed = 0;
  let notApplicable = 0;
  let unanswered = 0;

  for (const item of items) {
    const status = classifyResponseStatus(item.itemType, responses[item.id]?.value);
    switch (status) {
      case "PASS":
        acceptable += 1;
        break;
      case "FAIL":
        failed += 1;
        break;
      case "NOT_APPLICABLE":
        notApplicable += 1;
        break;
      default:
        unanswered += 1;
    }
  }

  return { acceptable, failed, notApplicable, unanswered, total: items.length };
}

/** Sanity guard used by both API and web tests: every `RecordStatus` this
 *  module reasons about must be a real, current status value. */
export function isKnownRecordStatus(status: string): status is RecordStatus {
  return (RECORD_STATUSES as readonly string[]).includes(status);
}

/** Sanity guard mirroring `isKnownRecordStatus` for shift codes supplied on
 *  the create-draft request. */
export function isKnownWorkShift(value: string): value is WorkShift {
  return (WORK_SHIFTS as readonly string[]).includes(value);
}
