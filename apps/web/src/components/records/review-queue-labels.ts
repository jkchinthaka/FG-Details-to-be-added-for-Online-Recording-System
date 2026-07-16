import type {
  ChecklistItemDefinition,
  ChecklistItemResponse,
  ChecklistTemplateVersionDefinition,
  InspectionRecordDetail,
} from "@nelna/shared";

export type ReviewFailedItemView = {
  itemId: string;
  label: string;
  sectionName: string;
  criticality: "Critical" | "Standard";
  evidenceState: "Attached" | "Missing" | "Not required";
  remark: string | null;
};

export type ReviewApprovalView = {
  key: string;
  actionLabel: string;
  decisionLabel: string;
  comments: string | null;
  decidedAtLabel: string;
};

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  CHECK: "Checked",
  VERIFY: "Verified",
  RETURN: "Returned for correction",
  REJECT: "Rejected",
  VOID: "Voided",
  COMPLETE: "Completed",
  LOADING_DECISION: "Loading decision",
};

const DECISION_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RETURNED: "Returned",
  RETURNED_FOR_CORRECTION: "Returned for correction",
  COMPLETED: "Completed",
  VOIDED: "Voided",
  PENDING: "Pending",
};

function findItemMeta(
  version: ChecklistTemplateVersionDefinition,
  itemId: string,
): { item: ChecklistItemDefinition; sectionName: string } | null {
  for (const section of version.sections) {
    const item = section.items.find((candidate) => candidate.id === itemId);
    if (item) return { item, sectionName: section.name };
  }
  return null;
}

function evidenceState(
  item: ChecklistItemDefinition | null,
  response: ChecklistItemResponse,
): ReviewFailedItemView["evidenceState"] {
  const attached = Boolean(response.evidence && response.evidence.length > 0);
  if (attached) return "Attached";
  if (item?.requiresEvidenceOnFail) return "Missing";
  return "Not required";
}

export function buildFailedItemViews(
  detail: InspectionRecordDetail,
): ReviewFailedItemView[] {
  return Object.entries(detail.responses)
    .filter(([, response]) => {
      if (
        !response?.value ||
        typeof response.value !== "object" ||
        !("value" in response.value)
      ) {
        return false;
      }
      const value = (response.value as { value?: string }).value;
      return value === "FAIL" || value === "UNACCEPTABLE";
    })
    .map(([itemId, response]) => {
      const meta = findItemMeta(detail.version, itemId);
      return {
        itemId,
        label: meta?.item.label ?? itemId,
        sectionName: meta?.sectionName ?? "Checklist",
        criticality: meta?.item.isCriticalFailure ? "Critical" : "Standard",
        evidenceState: evidenceState(meta?.item ?? null, response),
        remark: response.remark ?? null,
      };
    });
}

export function formatReviewTimestamp(value: string | null | undefined): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function humanizeApprovalType(value: string): string {
  return APPROVAL_TYPE_LABELS[value] ?? value.replaceAll("_", " ").toLowerCase();
}

export function humanizeDecision(value: string): string {
  return DECISION_LABELS[value] ?? value.replaceAll("_", " ").toLowerCase();
}

export function buildApprovalViews(
  history: Array<{
    id?: string;
    approvalType: string;
    decision: string;
    comments?: string | null;
    decidedAt?: string | null;
  }>,
): ReviewApprovalView[] {
  return history.map((row, index) => ({
    key: row.id ?? `${row.approvalType}-${row.decision}-${index}`,
    actionLabel: humanizeApprovalType(row.approvalType),
    decisionLabel: humanizeDecision(row.decision),
    comments: row.comments?.trim() ? row.comments.trim() : null,
    decidedAtLabel: formatReviewTimestamp(row.decidedAt),
  }));
}
