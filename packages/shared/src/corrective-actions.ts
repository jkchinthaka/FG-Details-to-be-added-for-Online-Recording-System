export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CORRECTIVE_ACTION_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "PENDING_VERIFICATION",
  "REJECTED",
  "VERIFIED",
  "CLOSED",
  "REOPENED",
  "OVERDUE",
  "CANCELLED",
  "CANCELLED_WITH_REASON",
] as const;

export type CorrectiveActionStatus = (typeof CORRECTIVE_ACTION_STATUSES)[number];

export const CORRECTIVE_ACTION_STATUS_LABELS: Record<CorrectiveActionStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  PENDING_VERIFICATION: "Pending verification",
  REJECTED: "Rejected",
  VERIFIED: "Verified",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  CANCELLED_WITH_REASON: "Cancelled",
};

export type CorrectiveActionSummary = {
  id: string;
  actionNumber: string | null;
  title: string;
  description: string;
  status: CorrectiveActionStatus;
  priority: Priority;
  recordId: string | null;
  resultId: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CorrectiveActionDetail = CorrectiveActionSummary & {
  rootCause: string | null;
  immediateCorrection: string | null;
  completionComment: string | null;
  verificationComment: string | null;
  rejectionReason: string | null;
  cancelReason: string | null;
  createdById: string;
  createdByName: string;
  verifiedById: string | null;
  verifiedByName: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
  reopenedAt: string | null;
  evidenceCount: number;
};

export type CorrectiveActionListResponse = {
  items: CorrectiveActionSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type ReinspectionCandidate = {
  recordId: string;
  documentCode: string;
  recordDate: string;
  vehicleNumber: string | null;
  freezerTruckNumber: string | null;
  loadingDecision: string | null;
  status: string;
  createdAt: string;
};
