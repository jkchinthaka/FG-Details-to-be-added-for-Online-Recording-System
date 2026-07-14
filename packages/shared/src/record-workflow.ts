/**
 * Record check / verify / return / reject / void workflow rules.
 *
 * Role names for who may act are permission-driven (`records:check`, etc.).
 * Segregation-of-duty defaults refuse creator self-check and checker
 * self-verify until BD-05 / BD-06 are APPROVED with different values —
 * these are interim safety defaults, not Nelna-approved policy claims.
 */
import type { RecordStatus } from "./records";

export const WORKFLOW_ACTIONS = [
  "SUBMIT",
  "CHECK",
  "VERIFY",
  "RETURN",
  "REJECT",
  "RESUBMIT",
  "COMPLETE",
  "VOID",
] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

/** Valid (fromStatus → action → toStatus) edges. */
export const WORKFLOW_TRANSITIONS: ReadonlyArray<{
  from: RecordStatus;
  action: WorkflowAction;
  to: RecordStatus;
}> = [
  { from: "DRAFT", action: "SUBMIT", to: "PENDING_CHECK" },
  { from: "RETURNED_FOR_CORRECTION", action: "RESUBMIT", to: "PENDING_CHECK" },
  { from: "REJECTED", action: "RESUBMIT", to: "PENDING_CHECK" },
  // Legacy SUBMITTED records (pre-Prompt 28) may still be checked
  { from: "SUBMITTED", action: "CHECK", to: "PENDING_VERIFICATION" },
  { from: "PENDING_CHECK", action: "CHECK", to: "PENDING_VERIFICATION" },
  { from: "PENDING_VERIFICATION", action: "VERIFY", to: "VERIFIED" },
  { from: "VERIFIED", action: "COMPLETE", to: "COMPLETED" },
  { from: "SUBMITTED", action: "RETURN", to: "RETURNED_FOR_CORRECTION" },
  { from: "PENDING_CHECK", action: "RETURN", to: "RETURNED_FOR_CORRECTION" },
  { from: "PENDING_VERIFICATION", action: "RETURN", to: "RETURNED_FOR_CORRECTION" },
  { from: "PENDING_VERIFICATION", action: "REJECT", to: "REJECTED" },
  { from: "VERIFIED", action: "VOID", to: "ARCHIVED" },
  { from: "COMPLETED", action: "VOID", to: "ARCHIVED" },
];

export function resolveWorkflowTransition(
  from: RecordStatus,
  action: WorkflowAction,
): RecordStatus | null {
  const edge = WORKFLOW_TRANSITIONS.find((t) => t.from === from && t.action === action);
  return edge?.to ?? null;
}

export function isValidWorkflowTransition(
  from: RecordStatus,
  action: WorkflowAction,
): boolean {
  return resolveWorkflowTransition(from, action) !== null;
}

export type WorkflowPolicy = {
  /** Interim default false until BD-05 APPROVED otherwise. */
  allowCreatorSelfCheck: boolean;
  /** Interim default false until BD-06 APPROVED otherwise. */
  allowCheckerSelfVerify: boolean;
};

export const DEFAULT_WORKFLOW_POLICY: WorkflowPolicy = {
  allowCreatorSelfCheck: false,
  allowCheckerSelfVerify: false,
};

export function assertCheckSegregationOfDuty(
  policy: WorkflowPolicy,
  actorUserId: string,
  createdById: string,
): { ok: true } | { ok: false; reason: string } {
  if (!policy.allowCreatorSelfCheck && actorUserId === createdById) {
    return {
      ok: false,
      reason: "Creator cannot check their own record (segregation of duty).",
    };
  }
  return { ok: true };
}

export function assertVerifySegregationOfDuty(
  policy: WorkflowPolicy,
  actorUserId: string,
  createdById: string,
  checkedById: string | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (actorUserId === createdById) {
    return { ok: false, reason: "Creator cannot verify their own record." };
  }
  if (!policy.allowCheckerSelfVerify && checkedById && actorUserId === checkedById) {
    return {
      ok: false,
      reason: "Checker cannot verify the same record (segregation of duty).",
    };
  }
  return { ok: true };
}

export function commentRequiredForAction(action: WorkflowAction): boolean {
  return action === "RETURN" || action === "REJECT" || action === "VOID";
}

export function isImmutableVerifiedStatus(status: RecordStatus): boolean {
  return status === "VERIFIED" || status === "COMPLETED" || status === "ARCHIVED";
}
