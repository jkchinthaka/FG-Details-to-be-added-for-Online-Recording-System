import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITEM_RULES,
  addItemSchema,
  applyMarkAllAcceptable,
  classifyResponseStatus,
  computeOverallProgress,
  computeSectionProgress,
  detectCriticalFailures,
  hasCriticalFailure,
  isFailureResponse,
  previewMarkAllAcceptable,
  validateChecklistResponses,
  type ChecklistItemDefinition,
  type ChecklistResponseMap,
  type ChecklistSectionDefinition,
} from "./checklist-engine";

function makeItem(overrides: Partial<ChecklistItemDefinition> = {}): ChecklistItemDefinition {
  return {
    ...DEFAULT_ITEM_RULES,
    id: overrides.id ?? "item-1",
    label: overrides.label ?? "Test item",
    helpText: null,
    sortOrder: overrides.sortOrder ?? 0,
    itemType: overrides.itemType ?? "ACCEPTABLE_UNACCEPTABLE_NA",
    options: overrides.options ?? [],
    ...overrides,
  };
}

function makeSection(items: ChecklistItemDefinition[], overrides: Partial<ChecklistSectionDefinition> = {}) {
  return {
    id: overrides.id ?? "section-1",
    name: overrides.name ?? "Section",
    sortOrder: overrides.sortOrder ?? 0,
    items,
  } satisfies ChecklistSectionDefinition;
}

describe("classifyResponseStatus", () => {
  it("is UNANSWERED when there is no value", () => {
    expect(classifyResponseStatus("PASS_FAIL_NA", null)).toBe("UNANSWERED");
    expect(classifyResponseStatus("SHORT_TEXT", undefined)).toBe("UNANSWERED");
  });

  it("maps status-type values straight through", () => {
    expect(classifyResponseStatus("PASS_FAIL_NA", { kind: "status", value: "FAIL" })).toBe("FAIL");
    expect(classifyResponseStatus("YES_NO_NA", { kind: "status", value: "NOT_APPLICABLE" })).toBe(
      "NOT_APPLICABLE",
    );
  });

  it("treats blank text as unanswered but non-blank text as answered", () => {
    expect(classifyResponseStatus("SHORT_TEXT", { kind: "text", value: "   " })).toBe("UNANSWERED");
    expect(classifyResponseStatus("SHORT_TEXT", { kind: "text", value: "ok" })).toBe("PASS");
  });

  it("treats any finite number as answered regardless of range", () => {
    expect(classifyResponseStatus("TEMPERATURE", { kind: "number", value: -40 })).toBe("PASS");
  });
});

describe("isFailureResponse", () => {
  it("flags a FAIL status response as a failure", () => {
    const item = makeItem({ itemType: "PASS_FAIL_NA" });
    expect(isFailureResponse(item, { itemId: item.id, value: { kind: "status", value: "FAIL" } })).toBe(
      true,
    );
  });

  it("does not flag PASS or N/A status responses as failures", () => {
    const item = makeItem({ itemType: "PASS_FAIL_NA" });
    expect(isFailureResponse(item, { itemId: item.id, value: { kind: "status", value: "PASS" } })).toBe(
      false,
    );
    expect(
      isFailureResponse(item, { itemId: item.id, value: { kind: "status", value: "NOT_APPLICABLE" } }),
    ).toBe(false);
  });

  it("flags a numeric reading outside min/max as a failure", () => {
    const item = makeItem({ itemType: "TEMPERATURE", minValue: -25, maxValue: -18 });
    expect(isFailureResponse(item, { itemId: item.id, value: { kind: "number", value: -10 } })).toBe(true);
    expect(isFailureResponse(item, { itemId: item.id, value: { kind: "number", value: -20 } })).toBe(false);
  });

  it("never flags free-text/date/select responses as failures", () => {
    const item = makeItem({ itemType: "SHORT_TEXT" });
    expect(isFailureResponse(item, { itemId: item.id, value: { kind: "text", value: "anything" } })).toBe(
      false,
    );
  });
});

describe("critical failure detection", () => {
  it("surfaces items flagged isCriticalFailure that are currently failing", () => {
    const criticalItem = makeItem({ id: "critical", itemType: "PASS_FAIL_NA", isCriticalFailure: true });
    const normalItem = makeItem({ id: "normal", itemType: "PASS_FAIL_NA" });
    const responses: ChecklistResponseMap = {
      critical: { itemId: "critical", value: { kind: "status", value: "FAIL" } },
      normal: { itemId: "normal", value: { kind: "status", value: "FAIL" } },
    };

    const critical = detectCriticalFailures([criticalItem, normalItem], responses);
    expect(critical.map((item) => item.id)).toEqual(["critical"]);
    expect(hasCriticalFailure([criticalItem, normalItem], responses)).toBe(true);
  });

  it("does not report a critical item as a critical failure while it passes", () => {
    const criticalItem = makeItem({ id: "critical", itemType: "PASS_FAIL_NA", isCriticalFailure: true });
    const responses: ChecklistResponseMap = {
      critical: { itemId: "critical", value: { kind: "status", value: "PASS" } },
    };
    expect(hasCriticalFailure([criticalItem], responses)).toBe(false);
  });

  it("treats an out-of-range critical numeric item as a critical failure", () => {
    const tempItem = makeItem({
      id: "temp",
      itemType: "TEMPERATURE",
      isCriticalFailure: true,
      minValue: -25,
      maxValue: -18,
    });
    const responses: ChecklistResponseMap = {
      temp: { itemId: "temp", value: { kind: "number", value: 5 } },
    };
    expect(hasCriticalFailure([tempItem], responses)).toBe(true);
  });
});

describe("Mark All Acceptable", () => {
  it("fills only unanswered, eligible (status-type) items", () => {
    const items = [
      makeItem({ id: "a", itemType: "PASS_FAIL_NA" }),
      makeItem({ id: "b", itemType: "ACCEPTABLE_UNACCEPTABLE_NA" }),
      makeItem({ id: "c", itemType: "SHORT_TEXT" }),
    ];
    const { itemIdsToFill } = previewMarkAllAcceptable(items, {});
    expect(itemIdsToFill.sort()).toEqual(["a", "b"]);

    const next = applyMarkAllAcceptable(items, {});
    expect(next.a?.value).toEqual({ kind: "status", value: "PASS" });
    expect(next.b?.value).toEqual({ kind: "status", value: "PASS" });
    expect(next.c).toBeUndefined();
  });

  it("never overwrites a manually recorded failure", () => {
    const items = [makeItem({ id: "a", itemType: "PASS_FAIL_NA" })];
    const responses: ChecklistResponseMap = {
      a: { itemId: "a", value: { kind: "status", value: "FAIL" }, remark: "Broken" },
    };

    const { itemIdsToFill, existingFailureItemIds } = previewMarkAllAcceptable(items, responses);
    expect(itemIdsToFill).toEqual([]);
    expect(existingFailureItemIds).toEqual(["a"]);

    const next = applyMarkAllAcceptable(items, responses);
    expect(next).toBe(responses);
    expect(next.a?.value).toEqual({ kind: "status", value: "FAIL" });
    expect(next.a?.remark).toBe("Broken");
  });

  it("leaves an already-acceptable or N/A item exactly as-is (idempotent)", () => {
    const items = [
      makeItem({ id: "a", itemType: "PASS_FAIL_NA" }),
      makeItem({ id: "b", itemType: "PASS_FAIL_NA", allowNotApplicable: true }),
    ];
    const responses: ChecklistResponseMap = {
      a: { itemId: "a", value: { kind: "status", value: "PASS" } },
      b: { itemId: "b", value: { kind: "status", value: "NOT_APPLICABLE" } },
    };

    const next = applyMarkAllAcceptable(items, responses);
    expect(next).toBe(responses);
  });

  it("does not touch non-eligible item types even when unanswered", () => {
    const items = [makeItem({ id: "n", itemType: "NUMBER" })];
    const next = applyMarkAllAcceptable(items, {});
    expect(next.n).toBeUndefined();
  });
});

describe("Clear all data-loss guard", () => {
  it("never called automatically by markAllAcceptable / validation (only explicit clearAllResponses)", () => {
    const items = [makeItem({ id: "a", itemType: "PASS_FAIL_NA" })];
    const responses: ChecklistResponseMap = {
      a: { itemId: "a", value: { kind: "status", value: "FAIL" }, remark: "note" },
    };
    validateChecklistResponses([makeSection(items)], responses);
    applyMarkAllAcceptable(items, responses);
    expect(responses.a).toEqual({
      itemId: "a",
      value: { kind: "status", value: "FAIL" },
      remark: "note",
    });
  });
});

describe("validateChecklistResponses (dynamic validation)", () => {
  it("requires an answer for required items", () => {
    const items = [makeItem({ id: "a", isRequired: true })];
    const result = validateChecklistResponses([makeSection(items)], {});
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatchObject({ itemId: "a", code: "REQUIRED" });
  });

  it("allows an optional item to stay unanswered", () => {
    const items = [makeItem({ id: "a", isRequired: false })];
    const result = validateChecklistResponses([makeSection(items)], {});
    expect(result.isValid).toBe(true);
  });

  it("rejects N/A when the item does not allow it", () => {
    const items = [makeItem({ id: "a", allowNotApplicable: false })];
    const responses: ChecklistResponseMap = {
      a: { itemId: "a", value: { kind: "status", value: "NOT_APPLICABLE" } },
    };
    const result = validateChecklistResponses([makeSection(items)], responses);
    expect(result.errors.map((e) => e.code)).toContain("NOT_APPLICABLE_NOT_ALLOWED");
  });

  it("requires a remark, evidence and corrective action on failure when configured", () => {
    const items = [
      makeItem({
        id: "a",
        remarkRequiredOnFail: true,
        requiresEvidenceOnFail: true,
        correctiveActionRequiredOnFail: true,
      }),
    ];
    const responses: ChecklistResponseMap = {
      a: { itemId: "a", value: { kind: "status", value: "FAIL" } },
    };
    const result = validateChecklistResponses([makeSection(items)], responses);
    expect(result.errors.map((e) => e.code).sort()).toEqual(
      ["CORRECTIVE_ACTION_REQUIRED", "EVIDENCE_REQUIRED", "REMARK_REQUIRED"].sort(),
    );

    const fixed = validateChecklistResponses([makeSection(items)], {
      a: {
        itemId: "a",
        value: { kind: "status", value: "FAIL" },
        remark: "Found residue",
        correctiveAction: "Recleaned and reinspected",
        evidence: [{ id: "e1", url: "data:...", fileName: "photo.jpg", capturedAt: new Date().toISOString() }],
      },
    });
    expect(fixed.isValid).toBe(true);
  });

  it("flags an out-of-range numeric reading", () => {
    const items = [makeItem({ id: "temp", itemType: "TEMPERATURE", minValue: -25, maxValue: -18 })];
    const responses: ChecklistResponseMap = {
      temp: { itemId: "temp", value: { kind: "number", value: 4 } },
    };
    const result = validateChecklistResponses([makeSection(items)], responses);
    expect(result.errors.map((e) => e.code)).toContain("OUT_OF_RANGE");
  });

  it("surfaces critical failures alongside ordinary validation errors", () => {
    const items = [makeItem({ id: "a", itemType: "PASS_FAIL_NA", isCriticalFailure: true })];
    const responses: ChecklistResponseMap = {
      a: { itemId: "a", value: { kind: "status", value: "FAIL" } },
    };
    const result = validateChecklistResponses([makeSection(items)], responses);
    expect(result.hasCriticalFailure).toBe(true);
    expect(result.criticalFailureItemIds).toEqual(["a"]);
  });
});

describe("progress computation", () => {
  it("computes section and overall progress from answered items", () => {
    const items = [
      makeItem({ id: "a", itemType: "PASS_FAIL_NA" }),
      makeItem({ id: "b", itemType: "PASS_FAIL_NA" }),
      makeItem({ id: "c", itemType: "SHORT_TEXT" }),
    ];
    const section = makeSection(items);
    const responses: ChecklistResponseMap = {
      a: { itemId: "a", value: { kind: "status", value: "PASS" } },
    };

    expect(computeSectionProgress(section, responses)).toEqual({ answered: 1, total: 3, percent: 33 });
    expect(computeOverallProgress([section], responses)).toEqual({ answered: 1, total: 3, percent: 33 });
  });

  it("reports 0% for an empty section without dividing by zero", () => {
    const section = makeSection([]);
    expect(computeSectionProgress(section, {})).toEqual({ answered: 0, total: 0, percent: 0 });
  });
});

describe("addItemSchema", () => {
  it("accepts a minimal valid item payload with defaults applied", () => {
    const parsed = addItemSchema.safeParse({ label: "Check the floor" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.itemType).toBe("ACCEPTABLE_UNACCEPTABLE_NA");
      expect(parsed.data.isRequired).toBe(true);
    }
  });

  it("rejects minValue greater than maxValue", () => {
    const parsed = addItemSchema.safeParse({
      label: "Temp reading",
      itemType: "TEMPERATURE",
      minValue: 10,
      maxValue: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("requires at least one option for SINGLE_SELECT items", () => {
    const parsed = addItemSchema.safeParse({ label: "Pick one", itemType: "SINGLE_SELECT" });
    expect(parsed.success).toBe(false);
  });
});
