/**
 * "Today's Tasks" mobile dashboard — shared response shapes and pure,
 * framework-free mapping/aggregation logic used by both the API (tasks
 * module) and the web app (dashboard hooks/tests). Kept here so the exact
 * same bucket/action rules are unit-testable once and can never drift
 * between server and client.
 */
import type { RecordType } from "./records";
import type { RecordStatus, TaskStatus } from "./records";
import type { UserRole } from "./roles";

/** Which bucket a task card counts toward in the compact progress summary. */
export const TASK_CARD_BUCKETS = ["completed", "pending", "attention"] as const;
export type TaskCardBucket = (typeof TASK_CARD_BUCKETS)[number];

/** The single, unambiguous next action a task card's button should offer. */
export const TASK_CARD_ACTIONS = ["START", "CONTINUE", "REVIEW", "COMPLETED"] as const;
export type TaskCardAction = (typeof TASK_CARD_ACTIONS)[number];

export const TASK_CARD_ACTION_LABELS: Record<TaskCardAction, string> = {
  START: "Start",
  CONTINUE: "Continue",
  REVIEW: "Review",
  COMPLETED: "Completed",
};

/** One operational item on the dashboard: an operator's own assignment, or a
 *  queue item awaiting a supervisor's/QA's action. Deliberately generic so
 *  every role variant renders through the same card component. */
export type TaskCard = {
  id: string;
  title: string;
  subtitle: string;
  documentCode: string | null;
  recordType: RecordType | null;
  areaLabel: string;
  shiftLabel: string | null;
  status: TaskStatus;
  bucket: TaskCardBucket;
  action: TaskCardAction;
  href: string;
};

export type DashboardSummary = {
  completed: number;
  pending: number;
  attentionRequired: number;
  totalCount: number;
  /** 0–100, share of `totalCount` that is `completed`. */
  completionPercent: number;
};

export type ComplianceIndicatorTone = "success" | "warning" | "danger" | "information";

/** Compact management/Food-Safety-Team-Leader indicator — a label + single
 *  value, deliberately not a chart (see docs/PROJECT_BRIEF.md UX guardrails). */
export type ComplianceIndicator = {
  id: string;
  label: string;
  value: string;
  tone: ComplianceIndicatorTone;
};

export type AdminShortcut = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export type RecentRecordSummary = {
  id: string;
  documentCode: string;
  title: string;
  status: RecordStatus;
  areaLabel: string | null;
  submittedAt: string | null;
  updatedAt: string;
};

export type TodaysTasksResponse = {
  generatedAt: string;
  /** Every role held by the requesting user — the dashboard renders the union of their widgets. */
  roles: UserRole[];
  summary: DashboardSummary;
  tasks: TaskCard[];
  complianceIndicators: ComplianceIndicator[];
  adminShortcuts: AdminShortcut[];
};

export type RecentRecordsResponse = {
  records: RecentRecordSummary[];
};

// ---------------------------------------------------------------------------
// Pure aggregation / formatting helpers
// ---------------------------------------------------------------------------

/** Tallies a set of task cards into the compact completed/pending/attention
 *  summary shown at the top of the dashboard. Never throws on an empty list. */
export function computeDashboardSummary(cards: TaskCard[]): DashboardSummary {
  const completed = cards.filter((card) => card.bucket === "completed").length;
  const pending = cards.filter((card) => card.bucket === "pending").length;
  const attentionRequired = cards.filter((card) => card.bucket === "attention").length;
  const totalCount = cards.length;
  const completionPercent = totalCount === 0 ? 0 : Math.round((completed / totalCount) * 100);

  return { completed, pending, attentionRequired, totalCount, completionPercent };
}

/** Bucket + action an operator's own assignment falls into, purely from its
 *  TaskStatus. Supervisor/QA queue cards (someone else's record) set these
 *  explicitly instead, since "pending" there means "pending on me to act". */
export function bucketForOwnTaskStatus(status: TaskStatus): TaskCardBucket {
  switch (status) {
    case "ASSIGNED":
    case "IN_PROGRESS":
      return "pending";
    case "REJECTED":
      return "attention";
    case "SUBMITTED":
    case "VERIFIED":
      return "completed";
    default:
      return "pending";
  }
}

export function actionForOwnTaskStatus(status: TaskStatus): TaskCardAction {
  switch (status) {
    case "ASSIGNED":
      return "START";
    case "IN_PROGRESS":
      return "CONTINUE";
    case "REJECTED":
      return "CONTINUE";
    case "SUBMITTED":
      return "REVIEW";
    case "VERIFIED":
      return "COMPLETED";
    default:
      return "START";
  }
}

/** Route an operator's task card should link to, based on the checklist
 *  template/record type it represents. Falls back to the records list for
 *  any type the mobile forms don't have a dedicated route for yet.
 *
 *  When `linkContext.recordId` is set (the assignment already has an
 *  in-progress/submitted InspectionRecord), links straight to that record's
 *  detail/continue view instead of the generic "start a new one" form.
 *  Otherwise, `linkContext.assignmentId` (when present) is passed through as
 *  a query param so the recording form can auto-populate its header and link
 *  itself back to the originating TaskAssignment on submit. */
export function hrefForRecordType(
  recordType: RecordType | null,
  linkContext?: { assignmentId?: string | null; recordId?: string | null },
): string {
  if (linkContext?.recordId) {
    return recordType === "DAILY_CLEANING_VERIFICATION"
      ? `/records/cleaning/${linkContext.recordId}`
      : `/records/${linkContext.recordId}`;
  }

  const base = (() => {
    switch (recordType) {
      case "DAILY_CLEANING_VERIFICATION":
        return "/records/cleaning";
      case "FREEZER_TRUCK_INSPECTION":
        return "/records/freezer-truck";
      default:
        return "/records";
    }
  })();

  if (linkContext?.assignmentId) {
    return `${base}?assignmentId=${encodeURIComponent(linkContext.assignmentId)}`;
  }
  return base;
}
