import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKFLOW_POLICY,
  assertCheckSegregationOfDuty,
  assertVerifySegregationOfDuty,
  commentRequiredForAction,
  isValidWorkflowTransition,
  resolveWorkflowTransition,
} from "./record-workflow";

describe("record-workflow transitions", () => {
  it("allows the happy path draft → pending check → pending verification → verified → completed", () => {
    expect(resolveWorkflowTransition("DRAFT", "SUBMIT")).toBe("PENDING_CHECK");
    expect(resolveWorkflowTransition("PENDING_CHECK", "CHECK")).toBe(
      "PENDING_VERIFICATION",
    );
    expect(resolveWorkflowTransition("PENDING_VERIFICATION", "VERIFY")).toBe("VERIFIED");
    expect(resolveWorkflowTransition("VERIFIED", "COMPLETE")).toBe("COMPLETED");
  });

  it("allows return and resubmission", () => {
    expect(isValidWorkflowTransition("PENDING_CHECK", "RETURN")).toBe(true);
    expect(resolveWorkflowTransition("RETURNED_FOR_CORRECTION", "RESUBMIT")).toBe(
      "PENDING_CHECK",
    );
  });

  it("rejects illegal skips", () => {
    expect(isValidWorkflowTransition("DRAFT", "VERIFY")).toBe(false);
    expect(isValidWorkflowTransition("PENDING_CHECK", "VERIFY")).toBe(false);
  });

  it("requires comments for return, reject and void", () => {
    expect(commentRequiredForAction("RETURN")).toBe(true);
    expect(commentRequiredForAction("REJECT")).toBe(true);
    expect(commentRequiredForAction("VOID")).toBe(true);
    expect(commentRequiredForAction("CHECK")).toBe(false);
  });

  it("blocks creator self-check by default policy", () => {
    const result = assertCheckSegregationOfDuty(DEFAULT_WORKFLOW_POLICY, "u1", "u1");
    expect(result.ok).toBe(false);
  });

  it("blocks creator and checker self-verify by default policy", () => {
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
