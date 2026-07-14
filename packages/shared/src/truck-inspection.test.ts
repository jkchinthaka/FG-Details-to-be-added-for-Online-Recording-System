import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITEM_RULES,
  type ChecklistItemDefinition,
  type ChecklistResponseMap,
} from "./checklist-engine";
import {
  allowedFinalDecisions,
  computeRecommendedLoadingDecision,
  createTruckDraftSchema,
  isOverrideToApprovedAllowed,
  loadingDecisionInputSchema,
} from "./truck-inspection";

function makeItem(
  overrides: Partial<ChecklistItemDefinition> = {},
): ChecklistItemDefinition {
  return {
    ...DEFAULT_ITEM_RULES,
    id: overrides.id ?? "item-1",
    label: overrides.label ?? "Door lock",
    helpText: null,
    sortOrder: overrides.sortOrder ?? 0,
    itemType: overrides.itemType ?? "PASS_FAIL_NA",
    options: overrides.options ?? [],
    ...overrides,
  };
}

function pass(itemId: string) {
  return { itemId, value: { kind: "status" as const, value: "PASS" as const } };
}

function fail(itemId: string) {
  return {
    itemId,
    value: { kind: "status" as const, value: "FAIL" as const },
    remark: "Failed",
  };
}

describe("computeRecommendedLoadingDecision", () => {
  it("recommends APPROVED_FOR_LOADING when every item passes (All Conditions Passed)", () => {
    const items = [
      makeItem({ id: "a" }),
      makeItem({ id: "b" }),
      makeItem({ id: "c", isCriticalFailure: true }),
    ];
    const responses: ChecklistResponseMap = { a: pass("a"), b: pass("b"), c: pass("c") };

    const result = computeRecommendedLoadingDecision(items, responses);

    expect(result).toEqual({
      decision: "APPROVED_FOR_LOADING",
      hasCriticalFailure: false,
      hasAnyFailure: false,
      criticalFailureItemIds: [],
    });
  });

  it("recommends CONDITIONALLY_APPROVED when a non-critical item fails", () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    const responses: ChecklistResponseMap = { a: pass("a"), b: fail("b") };

    const result = computeRecommendedLoadingDecision(items, responses);

    expect(result.decision).toBe("CONDITIONALLY_APPROVED");
    expect(result.hasCriticalFailure).toBe(false);
    expect(result.hasAnyFailure).toBe(true);
  });

  it("recommends LOADING_BLOCKED when any critical item fails, even if other items pass", () => {
    const items = [
      makeItem({ id: "a" }),
      makeItem({ id: "insects_presence", isCriticalFailure: true }),
    ];
    const responses: ChecklistResponseMap = {
      a: pass("a"),
      insects_presence: fail("insects_presence"),
    };

    const result = computeRecommendedLoadingDecision(items, responses);

    expect(result.decision).toBe("LOADING_BLOCKED");
    expect(result.hasCriticalFailure).toBe(true);
    expect(result.criticalFailureItemIds).toEqual(["insects_presence"]);
  });

  it("prioritizes LOADING_BLOCKED over CONDITIONALLY_APPROVED when both a critical and non-critical item fail", () => {
    const items = [
      makeItem({ id: "door_lock", isCriticalFailure: true }),
      makeItem({ id: "floor" }),
    ];
    const responses: ChecklistResponseMap = {
      door_lock: fail("door_lock"),
      floor: fail("floor"),
    };

    expect(computeRecommendedLoadingDecision(items, responses).decision).toBe(
      "LOADING_BLOCKED",
    );
  });
});

describe("isOverrideToApprovedAllowed / allowedFinalDecisions", () => {
  it("never allows an approved outcome once the recommendation is LOADING_BLOCKED", () => {
    expect(isOverrideToApprovedAllowed("LOADING_BLOCKED")).toBe(false);
    expect(allowedFinalDecisions("LOADING_BLOCKED")).toEqual([
      "LOADING_BLOCKED",
      "REJECTED",
    ]);
  });

  it("allows any final decision when the recommendation isn't a critical block", () => {
    expect(isOverrideToApprovedAllowed("CONDITIONALLY_APPROVED")).toBe(true);
    expect(isOverrideToApprovedAllowed("APPROVED_FOR_LOADING")).toBe(true);
    expect(allowedFinalDecisions("APPROVED_FOR_LOADING")).toEqual([
      "APPROVED_FOR_LOADING",
      "CONDITIONALLY_APPROVED",
      "LOADING_BLOCKED",
      "REJECTED",
    ]);
  });
});

describe("createTruckDraftSchema", () => {
  it("accepts a vehicleId-only payload", () => {
    expect(createTruckDraftSchema.safeParse({ vehicleId: "vehicle-1" }).success).toBe(
      true,
    );
  });

  it("accepts a manual freezerTruckNumber + vehicleNumber payload", () => {
    expect(
      createTruckDraftSchema.safeParse({
        freezerTruckNumber: "FT-09",
        vehicleNumber: "WP AB-1111",
      }).success,
    ).toBe(true);
  });

  it("rejects a payload with neither a vehicleId nor manual truck/vehicle numbers", () => {
    const result = createTruckDraftSchema.safeParse({ loadingReference: "LR-1" });
    expect(result.success).toBe(false);
  });

  it("rejects a manual entry missing the vehicle number", () => {
    const result = createTruckDraftSchema.safeParse({ freezerTruckNumber: "FT-09" });
    expect(result.success).toBe(false);
  });

  it("accepts an optional reinspectionOfRecordId", () => {
    expect(
      createTruckDraftSchema.safeParse({
        vehicleId: "vehicle-1",
        reinspectionOfRecordId: "record-1",
      }).success,
    ).toBe(true);
  });
});

describe("loadingDecisionInputSchema", () => {
  it("accepts every final decision value", () => {
    for (const decision of [
      "APPROVED_FOR_LOADING",
      "CONDITIONALLY_APPROVED",
      "LOADING_BLOCKED",
      "REJECTED",
    ]) {
      expect(loadingDecisionInputSchema.safeParse({ decision }).success).toBe(true);
    }
  });

  it("rejects PENDING as a final decision", () => {
    expect(loadingDecisionInputSchema.safeParse({ decision: "PENDING" }).success).toBe(
      false,
    );
  });
});
