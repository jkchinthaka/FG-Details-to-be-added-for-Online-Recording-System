import { describe, expect, it } from "vitest";
import { DEFAULT_ITEM_RULES, type ChecklistItemDefinition, type ChecklistResponseMap } from "./checklist-engine";
import {
  computeRecordCounts,
  createCleaningDraftSchema,
  formatRecordNumber,
  isActiveBlockingStatus,
  isRecordEditable,
  nextResponsibleRoleForStatus,
  resolveDraftDuplicate,
  saveDraftResponsesSchema,
} from "./inspection-records";

function makeItem(overrides: Partial<ChecklistItemDefinition> = {}): ChecklistItemDefinition {
  return {
    ...DEFAULT_ITEM_RULES,
    id: overrides.id ?? "item-1",
    label: overrides.label ?? "Wall",
    helpText: null,
    sortOrder: overrides.sortOrder ?? 0,
    itemType: overrides.itemType ?? "ACCEPTABLE_UNACCEPTABLE_NA",
    options: overrides.options ?? [],
    ...overrides,
  };
}

describe("formatRecordNumber", () => {
  it("derives a stable, human-readable number from documentCode + date + id", () => {
    expect(formatRecordNumber("NMS/PPU/CL/24", "2026-07-14", "clxyzabc123456")).toBe(
      "NMS/PPU/CL/24/20260714/123456",
    );
  });

  it("uppercases the id suffix", () => {
    expect(formatRecordNumber("NMS/PPU/CL/24", "2026-07-14", "abc123def")).toBe("NMS/PPU/CL/24/20260714/123DEF");
  });
});

describe("isRecordEditable / isActiveBlockingStatus", () => {
  it("treats DRAFT and REJECTED as editable", () => {
    expect(isRecordEditable("DRAFT")).toBe(true);
    expect(isRecordEditable("REJECTED")).toBe(true);
  });

  it("locks SUBMITTED/CHECKED/VERIFIED/ARCHIVED from operator editing", () => {
    expect(isRecordEditable("SUBMITTED")).toBe(false);
    expect(isRecordEditable("CHECKED")).toBe(false);
    expect(isRecordEditable("VERIFIED")).toBe(false);
    expect(isRecordEditable("ARCHIVED")).toBe(false);
  });

  it("flags SUBMITTED/CHECKED/VERIFIED as active-blocking for duplicate prevention", () => {
    expect(isActiveBlockingStatus("SUBMITTED")).toBe(true);
    expect(isActiveBlockingStatus("CHECKED")).toBe(true);
    expect(isActiveBlockingStatus("VERIFIED")).toBe(true);
    expect(isActiveBlockingStatus("DRAFT")).toBe(false);
    expect(isActiveBlockingStatus("REJECTED")).toBe(false);
  });
});

describe("nextResponsibleRoleForStatus", () => {
  it("hands off to the FG Supervisor once submitted", () => {
    expect(nextResponsibleRoleForStatus("SUBMITTED")).toBe("FG_SUPERVISOR");
  });

  it("hands off to QA once checked", () => {
    expect(nextResponsibleRoleForStatus("CHECKED")).toBe("QA_EXECUTIVE");
  });

  it("hands back to the operator once rejected", () => {
    expect(nextResponsibleRoleForStatus("REJECTED")).toBe("FG_OPERATOR");
  });

  it("has no next responsible role once verified", () => {
    expect(nextResponsibleRoleForStatus("VERIFIED")).toBeNull();
  });
});

describe("resolveDraftDuplicate", () => {
  it("creates a new record when none exists", () => {
    expect(resolveDraftDuplicate(null, "user-1")).toEqual({ outcome: "create" });
  });

  it("treats an archived existing record as no obstacle to creating a new one", () => {
    expect(resolveDraftDuplicate({ id: "rec-1", status: "ARCHIVED", createdById: "user-1" }, "user-1")).toEqual({
      outcome: "create",
    });
  });

  it("resumes the requester's own draft instead of duplicating it", () => {
    expect(resolveDraftDuplicate({ id: "rec-1", status: "DRAFT", createdById: "user-1" }, "user-1")).toEqual({
      outcome: "resume",
      recordId: "rec-1",
    });
  });

  it("resumes the requester's own rejected record (returned-correction workflow)", () => {
    expect(resolveDraftDuplicate({ id: "rec-1", status: "REJECTED", createdById: "user-1" }, "user-1")).toEqual({
      outcome: "resume",
      recordId: "rec-1",
    });
  });

  it("conflicts when another operator owns the active draft", () => {
    const result = resolveDraftDuplicate({ id: "rec-1", status: "DRAFT", createdById: "someone-else" }, "user-1");
    expect(result.outcome).toBe("conflict");
  });

  it("conflicts once the record has already been submitted, regardless of owner", () => {
    const result = resolveDraftDuplicate({ id: "rec-1", status: "SUBMITTED", createdById: "user-1" }, "user-1");
    expect(result.outcome).toBe("conflict");
  });
});

describe("computeRecordCounts", () => {
  it("tallies acceptable, failed, N/A and unanswered items", () => {
    const items = [
      makeItem({ id: "a" }),
      makeItem({ id: "b" }),
      makeItem({ id: "c", allowNotApplicable: true }),
      makeItem({ id: "d" }),
    ];
    const responses: ChecklistResponseMap = {
      a: { itemId: "a", value: { kind: "status", value: "PASS" } },
      b: { itemId: "b", value: { kind: "status", value: "FAIL" }, remark: "Dirty" },
      c: { itemId: "c", value: { kind: "status", value: "NOT_APPLICABLE" } },
    };

    expect(computeRecordCounts(items, responses)).toEqual({
      acceptable: 1,
      failed: 1,
      notApplicable: 1,
      unanswered: 1,
      total: 4,
    });
  });
});

describe("createCleaningDraftSchema", () => {
  it("accepts a bare recordDate", () => {
    expect(createCleaningDraftSchema.safeParse({ recordDate: "2026-07-14" }).success).toBe(true);
  });

  it("accepts an empty payload — recordDate/shift default server-side to today's date/shift", () => {
    expect(createCleaningDraftSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a malformed recordDate", () => {
    expect(createCleaningDraftSchema.safeParse({ recordDate: "14-07-2026" }).success).toBe(false);
  });
});

describe("saveDraftResponsesSchema", () => {
  it("accepts a response map keyed by item id", () => {
    const result = saveDraftResponsesSchema.safeParse({
      responses: {
        "item-1": { itemId: "item-1", value: { kind: "status", value: "FAIL" }, remark: "Dirty" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown value kind", () => {
    const result = saveDraftResponsesSchema.safeParse({
      responses: {
        "item-1": { itemId: "item-1", value: { kind: "bogus", value: "x" } },
      },
    });
    expect(result.success).toBe(false);
  });
});
