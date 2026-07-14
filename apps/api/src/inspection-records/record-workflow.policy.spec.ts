import { WorkflowSegregationOfDutyException } from "./inspection-records.errors";
import {
  DEFAULT_WORKFLOW_POLICY,
  assertCheckSegregationOfDuty,
  assertVerifySegregationOfDuty,
  commentRequiredForAction,
  isValidWorkflowTransition,
} from "@nelna/shared";

describe("workflow policy helpers used by InspectionRecordsService", () => {
  it("valid path and return/resubmit edges", () => {
    expect(isValidWorkflowTransition("PENDING_CHECK", "CHECK")).toBe(true);
    expect(isValidWorkflowTransition("PENDING_VERIFICATION", "VERIFY")).toBe(true);
    expect(isValidWorkflowTransition("PENDING_CHECK", "RETURN")).toBe(true);
    expect(isValidWorkflowTransition("RETURNED_FOR_CORRECTION", "RESUBMIT")).toBe(true);
    expect(isValidWorkflowTransition("DRAFT", "VERIFY")).toBe(false);
  });

  it("requires comments for return reject void", () => {
    expect(commentRequiredForAction("RETURN")).toBe(true);
    expect(commentRequiredForAction("REJECT")).toBe(true);
    expect(commentRequiredForAction("VOID")).toBe(true);
  });

  it("enforces creator cannot self-check under default policy", () => {
    const result = assertCheckSegregationOfDuty(DEFAULT_WORKFLOW_POLICY, "u1", "u1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(() => {
        throw new WorkflowSegregationOfDutyException(result.reason);
      }).toThrow(WorkflowSegregationOfDutyException);
    }
  });

  it("enforces creator and checker cannot self-verify under default policy", () => {
    expect(
      assertVerifySegregationOfDuty(
        DEFAULT_WORKFLOW_POLICY,
        "creator",
        "creator",
        "checker",
      ).ok,
    ).toBe(false);
    expect(
      assertVerifySegregationOfDuty(
        DEFAULT_WORKFLOW_POLICY,
        "checker",
        "creator",
        "checker",
      ).ok,
    ).toBe(false);
    expect(
      assertVerifySegregationOfDuty(DEFAULT_WORKFLOW_POLICY, "qa", "creator", "checker")
        .ok,
    ).toBe(true);
  });
});
