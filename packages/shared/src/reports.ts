import { z } from "zod";
import { DOCUMENT_CODES, RECORD_STATUSES, WORK_SHIFTS } from "./records";

/** Catalog of operational report kinds for the Nelna FG platform. */
export const REPORT_KINDS = [
  "daily_record_completion",
  "daily_failed_items",
  "pending_checks",
  "pending_verifications",
  "cleaning_compliance",
  "finished_goods_section_compliance",
  "changing_room_compliance",
  "truck_inspections",
  "truck_pass_fail_trend",
  "blocked_trucks",
  "common_failure_reasons",
  "corrective_action_status",
  "overdue_corrective_actions",
  "user_wise_record_completion",
  "section_wise_compliance",
  "audit_activity_summary",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  daily_record_completion: "Daily record completion",
  daily_failed_items: "Daily failed items",
  pending_checks: "Pending checks",
  pending_verifications: "Pending verifications",
  cleaning_compliance: "Cleaning compliance",
  finished_goods_section_compliance: "Finished Goods section compliance",
  changing_room_compliance: "Changing Room compliance",
  truck_inspections: "Truck inspections",
  truck_pass_fail_trend: "Truck pass/fail trend",
  blocked_trucks: "Blocked truck report",
  common_failure_reasons: "Common failure reasons",
  corrective_action_status: "Corrective-action status",
  overdue_corrective_actions: "Overdue corrective actions",
  user_wise_record_completion: "User-wise record completion",
  section_wise_compliance: "Section-wise compliance",
  audit_activity_summary: "Audit activity summary",
};

/** Maximum inclusive date window for a single report request (calendar days). */
export const REPORT_MAX_DATE_RANGE_DAYS = 93;

/** FG-PERF-001 — hard cap for any single materialization (sync or job). */
export const REPORT_MAX_EXPORT_ROWS = 5_000;

/**
 * Sync CSV through the Worker proxy must finish well under ~30s.
 * Larger exports must use the background job + download-token flow.
 */
export const REPORT_SYNC_EXPORT_MAX_ROWS = 500;

/** Background export job TTL (hours). */
export const REPORT_EXPORT_JOB_TTL_HOURS = 24;

export const REPORT_EXPORT_JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type ReportExportJobStatus = (typeof REPORT_EXPORT_JOB_STATUSES)[number];

export const reportFilterFieldsSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documentCode: z
    .enum([DOCUMENT_CODES.DAILY_CLEANING, DOCUMENT_CODES.FREEZER_TRUCK])
    .optional(),
  sectionId: z.string().min(1).optional(),
  shiftCode: z.enum(WORK_SHIFTS).optional(),
  status: z.enum(RECORD_STATUSES).optional(),
  userId: z.string().min(1).optional(),
  vehicleId: z.string().min(1).optional(),
  failureType: z.enum(["FAIL", "UNACCEPTABLE"]).optional(),
  correctiveActionOwnerId: z.string().min(1).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const reportFiltersSchema = reportFilterFieldsSchema.superRefine((value, ctx) => {
  if (value.fromDate > value.toDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fromDate must be on or before toDate",
    });
  }
  const from = Date.parse(`${value.fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${value.toDate}T00:00:00.000Z`);
  const days = Math.floor((to - from) / (24 * 60 * 60 * 1000)) + 1;
  if (days > REPORT_MAX_DATE_RANGE_DAYS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Date range must not exceed ${REPORT_MAX_DATE_RANGE_DAYS} days`,
    });
  }
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export const reportExportJobCreateSchema = z.object({
  kind: z.enum(REPORT_KINDS),
  filters: reportFilterFieldsSchema
    .omit({ page: true, pageSize: true })
    .superRefine((value, ctx) => {
      if (value.fromDate > value.toDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fromDate must be on or before toDate",
        });
      }
      const from = Date.parse(`${value.fromDate}T00:00:00.000Z`);
      const to = Date.parse(`${value.toDate}T00:00:00.000Z`);
      const days = Math.floor((to - from) / (24 * 60 * 60 * 1000)) + 1;
      if (days > REPORT_MAX_DATE_RANGE_DAYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Date range must not exceed ${REPORT_MAX_DATE_RANGE_DAYS} days`,
        });
      }
    }),
  idempotencyKey: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/, "Invalid idempotency key"),
});

export type ReportExportJobCreateInput = z.infer<typeof reportExportJobCreateSchema>;

export type ReportExportJobSummary = {
  id: string;
  kind: ReportKind;
  status: ReportExportJobStatus;
  progressPercent: number;
  rowCount: number | null;
  filename: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Present only while COMPLETED and not expired — opaque download token. */
  downloadToken: string | null;
  generatedAt: string;
};

export type ReportRow = Record<string, string | number | null>;

export type ReportResult = {
  kind: ReportKind;
  title: string;
  generatedAt: string;
  filters: ReportFilters;
  page: number;
  pageSize: number;
  totalRows: number;
  columns: string[];
  rows: ReportRow[];
};

export type OfficialRecordPdfMeta = {
  /** Explicitly not a cryptographic digital signature. */
  approvalDisclaimer: string;
};

export const OFFICIAL_RECORD_APPROVAL_DISCLAIMER =
  "Electronic approval — authenticated application action, not a cryptographic digital signature.";

/** Kinds available to operational supervisors (queues, cleaning, trucks). */
export const SUPERVISOR_REPORT_KINDS: readonly ReportKind[] = [
  "daily_record_completion",
  "daily_failed_items",
  "pending_checks",
  "pending_verifications",
  "cleaning_compliance",
  "finished_goods_section_compliance",
  "changing_room_compliance",
  "truck_inspections",
  "truck_pass_fail_trend",
  "blocked_trucks",
  "section_wise_compliance",
  "user_wise_record_completion",
];

/** Quality / CA-focused kinds (in addition to operational kinds for QA roles). */
export const QA_EXTRA_REPORT_KINDS: readonly ReportKind[] = [
  "common_failure_reasons",
  "corrective_action_status",
  "overdue_corrective_actions",
];

/** Aggregate / management kinds. */
export const MANAGEMENT_REPORT_KINDS: readonly ReportKind[] = [
  ...SUPERVISOR_REPORT_KINDS,
  ...QA_EXTRA_REPORT_KINDS,
  "audit_activity_summary",
];

/**
 * Resolve which report kinds a role set may run.
 * Operators are excluded (own-record PDF only). Auditors and admins get all.
 */
export function reportKindsForRoles(roles: readonly string[]): ReportKind[] {
  if (roles.includes("SYSTEM_ADMINISTRATOR") || roles.includes("AUDITOR")) {
    return [...REPORT_KINDS];
  }
  if (roles.includes("FOOD_SAFETY_TEAM_LEADER") || roles.includes("QA_EXECUTIVE")) {
    return [...MANAGEMENT_REPORT_KINDS];
  }
  if (roles.includes("FG_SUPERVISOR")) {
    return [...SUPERVISOR_REPORT_KINDS];
  }
  return [];
}
