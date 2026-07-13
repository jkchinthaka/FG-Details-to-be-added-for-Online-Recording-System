/**
 * Dynamic checklist template engine — shared types, zod schemas and pure
 * logic used by both the API (template CRUD/versioning) and the web app
 * (template preview / dynamic renderer). Kept framework-free so it can be
 * unit tested in isolation and imported from Node (NestJS) or the browser.
 *
 * See docs/CHECKLIST_ENGINE.md for the full design write-up.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Item types
// ---------------------------------------------------------------------------

/** Mirrors the Prisma `ChecklistItemType` enum (apps/api/prisma/schema.prisma). */
export const CHECKLIST_ITEM_TYPES = [
  "PASS_FAIL_NA",
  "ACCEPTABLE_UNACCEPTABLE_NA",
  "YES_NO_NA",
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "TEMPERATURE",
  "DATE",
  "TIME",
  "SINGLE_SELECT",
  "PHOTO_EVIDENCE",
  "SIGNATURE",
] as const;

export type ChecklistItemType = (typeof CHECKLIST_ITEM_TYPES)[number];

/** The three "status" item types render as a segmented control and share the
 *  same underlying PASS / FAIL / NOT_APPLICABLE semantics, just with
 *  different labels (Pass/Fail, Acceptable/Unacceptable, Yes/No). */
export const STATUS_ITEM_TYPES = [
  "PASS_FAIL_NA",
  "ACCEPTABLE_UNACCEPTABLE_NA",
  "YES_NO_NA",
] as const satisfies readonly ChecklistItemType[];

export type StatusItemType = (typeof STATUS_ITEM_TYPES)[number];

export function isStatusItemType(itemType: ChecklistItemType): itemType is StatusItemType {
  return (STATUS_ITEM_TYPES as readonly string[]).includes(itemType);
}

/** Normalized status value every "status" item type ultimately resolves to. */
export const NORMALIZED_STATUS_VALUES = ["PASS", "FAIL", "NOT_APPLICABLE"] as const;
export type NormalizedStatusValue = (typeof NORMALIZED_STATUS_VALUES)[number];

export type ChecklistItemTypeMeta = {
  label: string;
  description: string;
  /** Broad control family the renderer picks based on this. */
  control:
    | "status"
    | "short_text"
    | "long_text"
    | "number"
    | "temperature"
    | "date"
    | "time"
    | "single_select"
    | "photo"
    | "signature";
  /** Only present for `control: "status"` — the three segmented options in
   *  display order, each carrying the type-specific label for the shared
   *  normalized value. */
  statusOptions?: Array<{ value: NormalizedStatusValue; label: string }>;
};

export const CHECKLIST_ITEM_TYPE_META: Record<ChecklistItemType, ChecklistItemTypeMeta> = {
  PASS_FAIL_NA: {
    label: "Pass / Fail / N/A",
    description: "Binary pass-fail inspection result",
    control: "status",
    statusOptions: [
      { value: "PASS", label: "Pass" },
      { value: "FAIL", label: "Fail" },
      { value: "NOT_APPLICABLE", label: "N/A" },
    ],
  },
  ACCEPTABLE_UNACCEPTABLE_NA: {
    label: "Acceptable / Unacceptable / N/A",
    description: "Exception-based cleaning/condition result",
    control: "status",
    statusOptions: [
      { value: "PASS", label: "Acceptable" },
      { value: "FAIL", label: "Unacceptable" },
      { value: "NOT_APPLICABLE", label: "N/A" },
    ],
  },
  YES_NO_NA: {
    label: "Yes / No / N/A",
    description: "Simple yes/no confirmation",
    control: "status",
    statusOptions: [
      { value: "PASS", label: "Yes" },
      { value: "FAIL", label: "No" },
      { value: "NOT_APPLICABLE", label: "N/A" },
    ],
  },
  SHORT_TEXT: {
    label: "Short text",
    description: "Single-line free text",
    control: "short_text",
  },
  LONG_TEXT: {
    label: "Long text",
    description: "Multi-line free text",
    control: "long_text",
  },
  NUMBER: {
    label: "Number",
    description: "Numeric reading, optionally bounded by min/max",
    control: "number",
  },
  TEMPERATURE: {
    label: "Temperature",
    description: "Numeric temperature reading (°C), optionally bounded by min/max",
    control: "temperature",
  },
  DATE: {
    label: "Date",
    description: "Calendar date",
    control: "date",
  },
  TIME: {
    label: "Time",
    description: "Time of day",
    control: "time",
  },
  SINGLE_SELECT: {
    label: "Single select",
    description: "One choice from a preset option list",
    control: "single_select",
  },
  PHOTO_EVIDENCE: {
    label: "Photo evidence",
    description: "Photo capture/upload as the primary response",
    control: "photo",
  },
  SIGNATURE: {
    label: "Signature / acknowledgement",
    description: "Signature or acknowledgement metadata (name, timestamp)",
    control: "signature",
  },
};

/** Item types eligible for the one-tap "Mark All Acceptable" action — only
 *  the status types have a well-defined, always-safe "acceptable" value.
 *  Free text / numeric / date / photo / signature responses always require
 *  a human-entered value and are never auto-filled. */
export function isEligibleForMarkAllAcceptable(itemType: ChecklistItemType): boolean {
  return isStatusItemType(itemType);
}

// ---------------------------------------------------------------------------
// Response value model
// ---------------------------------------------------------------------------

export type EvidencePhoto = {
  id: string;
  /** Data URL, blob URL, or remote URL — the renderer treats this as opaque. */
  url: string;
  fileName: string;
  capturedAt: string;
};

export type SignatureValue = {
  signedByName: string;
  signedAt: string;
};

export type ChecklistItemValue =
  | { kind: "status"; value: NormalizedStatusValue }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number }
  | { kind: "date"; value: string }
  | { kind: "time"; value: string }
  | { kind: "select"; value: string }
  | { kind: "photo"; value: EvidencePhoto[] }
  | { kind: "signature"; value: SignatureValue };

/** One operator's answer to one ChecklistItem, plus the failure-handling
 *  detail fields that only apply once the response is a failure. */
export type ChecklistItemResponse = {
  itemId: string;
  value: ChecklistItemValue | null;
  remark?: string;
  correctiveAction?: string;
  evidence?: EvidencePhoto[];
};

export type ChecklistResponseMap = Record<string, ChecklistItemResponse>;

export const RESPONSE_STATUSES = ["UNANSWERED", "PASS", "FAIL", "NOT_APPLICABLE"] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

/** Maps any item type's current value to a generic PASS/FAIL/N/A/UNANSWERED
 *  status used for progress, mark-all-acceptable and failure detection.
 *  Non-status item types are never intrinsically PASS/FAIL from their raw
 *  value alone — see `isFailureResponse` for range-based failures. */
export function classifyResponseStatus(
  itemType: ChecklistItemType,
  value: ChecklistItemValue | null | undefined,
): ResponseStatus {
  if (!value) return "UNANSWERED";

  if (isStatusItemType(itemType)) {
    return value.kind === "status" ? value.value : "UNANSWERED";
  }

  switch (itemType) {
    case "SHORT_TEXT":
    case "LONG_TEXT":
      return value.kind === "text" && value.value.trim().length > 0 ? "PASS" : "UNANSWERED";
    case "NUMBER":
    case "TEMPERATURE":
      return value.kind === "number" && Number.isFinite(value.value) ? "PASS" : "UNANSWERED";
    case "DATE":
      return value.kind === "date" && value.value.length > 0 ? "PASS" : "UNANSWERED";
    case "TIME":
      return value.kind === "time" && value.value.length > 0 ? "PASS" : "UNANSWERED";
    case "SINGLE_SELECT":
      return value.kind === "select" && value.value.length > 0 ? "PASS" : "UNANSWERED";
    case "PHOTO_EVIDENCE":
      return value.kind === "photo" && value.value.length > 0 ? "PASS" : "UNANSWERED";
    case "SIGNATURE":
      return value.kind === "signature" && Boolean(value.value?.signedAt) ? "PASS" : "UNANSWERED";
    default:
      return "UNANSWERED";
  }
}

export function isAnswered(itemType: ChecklistItemType, response: ChecklistItemResponse | undefined): boolean {
  return classifyResponseStatus(itemType, response?.value) !== "UNANSWERED";
}

// ---------------------------------------------------------------------------
// Item / section / template definitions (the "compiled" shape the renderer
// and engine functions consume — API responses map onto this shape).
// ---------------------------------------------------------------------------

export type ChecklistItemOptionDefinition = {
  id?: string;
  value: string;
  label: string;
  sortOrder: number;
};

export type ChecklistItemRules = {
  isRequired: boolean;
  allowNotApplicable: boolean;
  requiresEvidenceOnFail: boolean;
  isCriticalFailure: boolean;
  remarkRequiredOnFail: boolean;
  correctiveActionRequiredOnFail: boolean;
  minValue?: number | null;
  maxValue?: number | null;
  defaultResponse?: string | null;
};

export type ChecklistItemDefinition = ChecklistItemRules & {
  id: string;
  label: string;
  helpText?: string | null;
  sortOrder: number;
  itemType: ChecklistItemType;
  options: ChecklistItemOptionDefinition[];
};

export type ChecklistSectionDefinition = {
  id: string;
  name: string;
  sortOrder: number;
  items: ChecklistItemDefinition[];
};

export type ChecklistTemplateVersionDefinition = {
  id: string;
  templateId: string;
  code: string;
  title: string;
  description?: string | null;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sections: ChecklistSectionDefinition[];
};

export type ChecklistTemplateVersionSummary = {
  id: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  notes?: string | null;
  publishedAt?: string | null;
};

/** Lightweight listing shape (no section/item content) for template browse
 *  and admin management screens. */
export type ChecklistTemplateSummary = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  currentVersion: ChecklistTemplateVersionSummary | null;
  versions: ChecklistTemplateVersionSummary[];
};

export const DEFAULT_ITEM_RULES: ChecklistItemRules = {
  isRequired: true,
  allowNotApplicable: false,
  requiresEvidenceOnFail: false,
  isCriticalFailure: false,
  remarkRequiredOnFail: false,
  correctiveActionRequiredOnFail: false,
  minValue: null,
  maxValue: null,
  defaultResponse: null,
};

export function flattenItems(sections: ChecklistSectionDefinition[]): ChecklistItemDefinition[] {
  return [...sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((section) => [...section.items].sort((a, b) => a.sortOrder - b.sortOrder));
}

// ---------------------------------------------------------------------------
// Failure / critical-failure detection
// ---------------------------------------------------------------------------

/** True when `response` represents a failing answer for `item`, considering
 *  both status-type FAIL selections and out-of-range numeric readings. */
export function isFailureResponse(
  item: Pick<ChecklistItemDefinition, "itemType" | "minValue" | "maxValue">,
  response: ChecklistItemResponse | undefined,
): boolean {
  const value = response?.value;
  if (!value) return false;

  if (isStatusItemType(item.itemType)) {
    return value.kind === "status" && value.value === "FAIL";
  }

  if ((item.itemType === "NUMBER" || item.itemType === "TEMPERATURE") && value.kind === "number") {
    if (typeof item.minValue === "number" && value.value < item.minValue) return true;
    if (typeof item.maxValue === "number" && value.value > item.maxValue) return true;
    return false;
  }

  return false;
}

/** Every item currently in a failing state that is also flagged
 *  `isCriticalFailure` — the record-level "critical failure" signal. */
export function detectCriticalFailures(
  items: ChecklistItemDefinition[],
  responses: ChecklistResponseMap,
): ChecklistItemDefinition[] {
  return items.filter((item) => item.isCriticalFailure && isFailureResponse(item, responses[item.id]));
}

export function hasCriticalFailure(items: ChecklistItemDefinition[], responses: ChecklistResponseMap): boolean {
  return detectCriticalFailures(items, responses).length > 0;
}

// ---------------------------------------------------------------------------
// Mark All Acceptable / Clear All
// ---------------------------------------------------------------------------

function acceptableValueForItemType(itemType: ChecklistItemType): ChecklistItemValue | null {
  return isStatusItemType(itemType) ? { kind: "status", value: "PASS" } : null;
}

export type MarkAllAcceptablePreview = {
  /** Item ids that would be filled by markAllAcceptable — always a subset of
   *  currently-unanswered, mark-all-eligible items. */
  itemIdsToFill: string[];
  /** Failing items left untouched, surfaced so the caller can show a
   *  "N items still need attention" hint without ever auto-overwriting them. */
  existingFailureItemIds: string[];
};

/** Low-click happy path: fills every eligible (status-type) item that has no
 *  answer yet with its "acceptable" value (Pass/Acceptable/Yes as
 *  appropriate). Items that already have *any* answer — including manual
 *  failures, N/A, or a prior acceptable — are left completely untouched, so
 *  this can never silently overwrite a recorded failure. */
export function previewMarkAllAcceptable(
  items: ChecklistItemDefinition[],
  responses: ChecklistResponseMap,
): MarkAllAcceptablePreview {
  const itemIdsToFill: string[] = [];
  const existingFailureItemIds: string[] = [];

  for (const item of items) {
    if (!isEligibleForMarkAllAcceptable(item.itemType)) continue;
    const status = classifyResponseStatus(item.itemType, responses[item.id]?.value);
    if (status === "UNANSWERED") {
      itemIdsToFill.push(item.id);
    } else if (status === "FAIL") {
      existingFailureItemIds.push(item.id);
    }
  }

  return { itemIdsToFill, existingFailureItemIds };
}

/** Applies `previewMarkAllAcceptable` and returns the next response map.
 *  Pure function — callers own state updates (autosave-ready). */
export function applyMarkAllAcceptable(
  items: ChecklistItemDefinition[],
  responses: ChecklistResponseMap,
): ChecklistResponseMap {
  const { itemIdsToFill } = previewMarkAllAcceptable(items, responses);
  if (itemIdsToFill.length === 0) return responses;

  const next: ChecklistResponseMap = { ...responses };
  for (const item of items) {
    if (!itemIdsToFill.includes(item.id)) continue;
    const value = acceptableValueForItemType(item.itemType);
    if (!value) continue;
    next[item.id] = { itemId: item.id, value };
  }
  return next;
}

/** Clears every response. Destructive — the UI must confirm with the
 *  operator before calling this (see ClearAllBar). */
export function clearAllResponses(): ChecklistResponseMap {
  return {};
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ChecklistValidationErrorCode =
  | "REQUIRED"
  | "NOT_APPLICABLE_NOT_ALLOWED"
  | "REMARK_REQUIRED"
  | "EVIDENCE_REQUIRED"
  | "CORRECTIVE_ACTION_REQUIRED"
  | "OUT_OF_RANGE";

export type ChecklistValidationError = {
  itemId: string;
  code: ChecklistValidationErrorCode;
  message: string;
};

export type ChecklistValidationResult = {
  isValid: boolean;
  errors: ChecklistValidationError[];
  criticalFailureItemIds: string[];
  hasCriticalFailure: boolean;
};

/** Full dynamic validation pass over every item in `sections` against the
 *  current `responses`, driven entirely by each item's configured rules —
 *  no per-template-code special-casing. */
export function validateChecklistResponses(
  sections: ChecklistSectionDefinition[],
  responses: ChecklistResponseMap,
): ChecklistValidationResult {
  const items = flattenItems(sections);
  const errors: ChecklistValidationError[] = [];

  for (const item of items) {
    const response = responses[item.id];
    const status = classifyResponseStatus(item.itemType, response?.value);
    const failed = isFailureResponse(item, response);

    if (status === "UNANSWERED") {
      if (item.isRequired) {
        errors.push({ itemId: item.id, code: "REQUIRED", message: `"${item.label}" requires a response` });
      }
      continue;
    }

    if (status === "NOT_APPLICABLE" && !item.allowNotApplicable) {
      errors.push({
        itemId: item.id,
        code: "NOT_APPLICABLE_NOT_ALLOWED",
        message: `"${item.label}" cannot be marked N/A`,
      });
    }

    if (
      (item.itemType === "NUMBER" || item.itemType === "TEMPERATURE") &&
      response?.value?.kind === "number" &&
      isFailureResponse(item, response)
    ) {
      errors.push({
        itemId: item.id,
        code: "OUT_OF_RANGE",
        message: `"${item.label}" is outside the allowed range`,
      });
    }

    if (failed) {
      if (item.remarkRequiredOnFail && !response?.remark?.trim()) {
        errors.push({
          itemId: item.id,
          code: "REMARK_REQUIRED",
          message: `Describe why "${item.label}" failed`,
        });
      }
      if (item.requiresEvidenceOnFail && !(response?.evidence && response.evidence.length > 0)) {
        errors.push({
          itemId: item.id,
          code: "EVIDENCE_REQUIRED",
          message: `Attach photo evidence for "${item.label}"`,
        });
      }
      if (item.correctiveActionRequiredOnFail && !response?.correctiveAction?.trim()) {
        errors.push({
          itemId: item.id,
          code: "CORRECTIVE_ACTION_REQUIRED",
          message: `Add a corrective action for "${item.label}"`,
        });
      }
    }
  }

  const criticalFailureItemIds = detectCriticalFailures(items, responses).map((item) => item.id);

  return {
    isValid: errors.length === 0,
    errors,
    criticalFailureItemIds,
    hasCriticalFailure: criticalFailureItemIds.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type ChecklistProgress = {
  answered: number;
  total: number;
  percent: number;
};

function toProgress(answered: number, total: number): ChecklistProgress {
  return { answered, total, percent: total === 0 ? 0 : Math.round((answered / total) * 100) };
}

export function computeSectionProgress(
  section: ChecklistSectionDefinition,
  responses: ChecklistResponseMap,
): ChecklistProgress {
  const answered = section.items.filter((item) => isAnswered(item.itemType, responses[item.id])).length;
  return toProgress(answered, section.items.length);
}

export function computeOverallProgress(
  sections: ChecklistSectionDefinition[],
  responses: ChecklistResponseMap,
): ChecklistProgress {
  const items = flattenItems(sections);
  const answered = items.filter((item) => isAnswered(item.itemType, responses[item.id])).length;
  return toProgress(answered, items.length);
}

// ---------------------------------------------------------------------------
// Zod schemas — template authoring payloads (API request bodies / web forms)
// ---------------------------------------------------------------------------

export const checklistItemTypeSchema = z.enum(CHECKLIST_ITEM_TYPES);

export const createTemplateDraftSchema = z.object({
  code: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
});
export type CreateTemplateDraftInput = z.infer<typeof createTemplateDraftSchema>;

export const addSectionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
});
export type AddSectionInput = z.infer<typeof addSectionSchema>;

export const reorderSectionsSchema = z.object({
  sectionIds: z.array(z.string().min(1)).min(1),
});
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;

export const itemOptionInputSchema = z.object({
  value: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).default(0),
});

function checkItemRuleInvariants<T extends { minValue?: number; maxValue?: number; itemType?: ChecklistItemType; options?: unknown[] }>(
  data: T,
  ctx: z.RefinementCtx,
): void {
  if (typeof data.minValue === "number" && typeof data.maxValue === "number" && data.minValue > data.maxValue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "minValue must be less than or equal to maxValue",
      path: ["minValue"],
    });
  }
  if (data.itemType === "SINGLE_SELECT" && (!data.options || data.options.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Single select items require at least one option",
      path: ["options"],
    });
  }
}

const itemFieldsShape = {
  label: z.string().trim().min(1).max(300),
  helpText: z.string().trim().max(1000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  itemType: checklistItemTypeSchema.default("ACCEPTABLE_UNACCEPTABLE_NA"),
  isRequired: z.boolean().default(true),
  allowNotApplicable: z.boolean().default(false),
  requiresEvidenceOnFail: z.boolean().default(false),
  isCriticalFailure: z.boolean().default(false),
  remarkRequiredOnFail: z.boolean().default(false),
  correctiveActionRequiredOnFail: z.boolean().default(false),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  defaultResponse: z.string().trim().max(200).optional(),
  options: z.array(itemOptionInputSchema).max(50).optional(),
};

export const addItemBaseSchema = z.object(itemFieldsShape);
export const addItemSchema = addItemBaseSchema.superRefine(checkItemRuleInvariants);
export type AddItemInput = z.infer<typeof addItemSchema>;

export const updateItemRulesSchema = addItemBaseSchema.partial().superRefine(checkItemRuleInvariants);
export type UpdateItemRulesInput = z.infer<typeof updateItemRulesSchema>;

export const reorderItemsSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
});
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;

export const publishVersionSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});
export type PublishVersionInput = z.infer<typeof publishVersionSchema>;
