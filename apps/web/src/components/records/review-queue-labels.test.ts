import { describe, expect, it } from "vitest";
import type { InspectionRecordDetail } from "@nelna/shared";
import {
  buildApprovalViews,
  buildFailedItemViews,
  formatReviewTimestamp,
  humanizeApprovalType,
  humanizeDecision,
} from "./review-queue-labels";

function sampleDetail(): InspectionRecordDetail {
  return {
    header: {
      id: "rec-1",
      documentCode: "NMS/FG/CL/01",
      recordNumber: "NMS/FG/CL/01/20260716/ABCDEF",
      templateTitle: "Daily Cleaning",
      templateVersionNumber: 1,
      status: "PENDING_CHECK",
      recordDate: "2026-07-16",
      recordMonth: "July 2026",
      shiftLabel: null,
      areaLabel: "Cold room",
      recordedBy: {
        id: "u1",
        fullName: "Operator One",
        employeeCode: "E1",
      },
      checkedBy: null,
      verifiedBy: null,
      createdAt: "2026-07-16T08:00:00.000Z",
      updatedAt: "2026-07-16T09:00:00.000Z",
      submittedAt: null,
      checkedAt: null,
      verifiedAt: null,
    },
    editable: false,
    truck: null,
    version: {
      id: "v1",
      templateId: "t1",
      code: "NMS/FG/CL/01",
      title: "Daily Cleaning",
      versionNumber: 1,
      status: "PUBLISHED",
      sections: [
        {
          id: "sec-1",
          name: "Floor and walls",
          sortOrder: 1,
          items: [
            {
              id: "item-floor",
              label: "Floor cleaned and dry",
              sortOrder: 1,
              itemType: "PASS_FAIL_NA",
              options: [],
              isRequired: true,
              allowNotApplicable: false,
              requiresEvidenceOnFail: true,
              isCriticalFailure: true,
              remarkRequiredOnFail: true,
              correctiveActionRequiredOnFail: true,
            },
          ],
        },
      ],
    },
    responses: {
      "item-floor": {
        itemId: "item-floor",
        value: { kind: "status", value: "FAIL" },
        remark: "Wet patch near drain",
        evidence: [],
      },
    },
  };
}

describe("FG-UX-002 review queue labels", () => {
  it("replaces item IDs with checklist labels and human criticality", () => {
    const views = buildFailedItemViews(sampleDetail());
    expect(views).toHaveLength(1);
    expect(views[0]?.label).toBe("Floor cleaned and dry");
    expect(views[0]?.sectionName).toBe("Floor and walls");
    expect(views[0]?.criticality).toBe("Critical");
    expect(views[0]?.evidenceState).toBe("Missing");
    expect(views[0]?.label).not.toBe("item-floor");
  });

  it("humanizes approval enums and timestamps", () => {
    expect(humanizeApprovalType("RETURN")).toBe("Returned for correction");
    expect(humanizeDecision("APPROVED")).toBe("Approved");
    expect(formatReviewTimestamp("2026-07-16T10:30:00.000Z")).not.toMatch(/T10:30/);

    const chronology = buildApprovalViews([
      {
        approvalType: "CHECK",
        decision: "APPROVED",
        comments: "Looks good",
        decidedAt: "2026-07-16T10:30:00.000Z",
      },
    ]);
    expect(chronology[0]?.actionLabel).toBe("Checked");
    expect(chronology[0]?.decisionLabel).toBe("Approved");
    expect(chronology[0]?.comments).toBe("Looks good");
    expect(chronology[0]?.decidedAtLabel).not.toMatch(/APPROVED|CHECK/);
  });
});
