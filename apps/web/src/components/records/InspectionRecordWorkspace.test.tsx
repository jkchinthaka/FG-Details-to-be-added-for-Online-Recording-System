import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  ChecklistTemplateVersionDefinition,
  InspectionRecordDetail,
  SubmitRecordResult,
} from "@nelna/shared";
import { DEFAULT_ITEM_RULES } from "@nelna/shared";
import * as api from "@/lib/inspection-records/api";
import { InspectionRecordApiError } from "@/lib/inspection-records/api";
import { InspectionRecordWorkspace } from "./InspectionRecordWorkspace";

beforeAll(() => {
  // jsdom does not implement scrollIntoView, which ChecklistRenderer calls
  // when jumping to a failing item from the validation summary.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function makeVersion(): ChecklistTemplateVersionDefinition {
  return {
    id: "version-1",
    templateId: "template-1",
    code: "NMS/PPU/CL/24",
    title: "Daily Cleaning Verification",
    versionNumber: 3,
    status: "PUBLISHED",
    sections: [
      {
        id: "section-fg",
        name: "Finished Goods",
        sortOrder: 0,
        items: [
          {
            ...DEFAULT_ITEM_RULES,
            id: "fg_wall",
            label: "Wall",
            helpText: null,
            sortOrder: 0,
            itemType: "ACCEPTABLE_UNACCEPTABLE_NA",
            options: [],
          },
          {
            ...DEFAULT_ITEM_RULES,
            id: "fg_floor",
            label: "Floor",
            helpText: null,
            sortOrder: 1,
            itemType: "ACCEPTABLE_UNACCEPTABLE_NA",
            options: [],
            remarkRequiredOnFail: true,
          },
        ],
      },
      {
        id: "section-cr",
        name: "Changing Room",
        sortOrder: 1,
        items: [
          {
            ...DEFAULT_ITEM_RULES,
            id: "cr_locker",
            label: "Locker",
            helpText: null,
            sortOrder: 0,
            itemType: "ACCEPTABLE_UNACCEPTABLE_NA",
            options: [],
          },
        ],
      },
    ],
  };
}

type DetailOverrides = Partial<Omit<InspectionRecordDetail, "header">> & {
  header?: Partial<InspectionRecordDetail["header"]>;
};

function makeDetail(overrides: DetailOverrides = {}): InspectionRecordDetail {
  const header: InspectionRecordDetail["header"] = {
    id: "record-1",
    documentCode: "NMS/PPU/CL/24",
    recordNumber: "NMS/PPU/CL/24/20260714/ABC123",
    templateTitle: "Daily Cleaning Verification",
    templateVersionNumber: 3,
    status: "DRAFT",
    recordDate: "2026-07-14",
    recordMonth: "July 2026",
    shiftLabel: "Morning",
    areaLabel: "Finished Goods + Changing Room",
    recordedBy: { id: "user-1", fullName: "Jane Operator", employeeCode: "EMP-001" },
    checkedBy: null,
    verifiedBy: null,
    createdAt: "2026-07-14T01:00:00.000Z",
    updatedAt: "2026-07-14T01:00:00.000Z",
    submittedAt: null,
    checkedAt: null,
    verifiedAt: null,
    ...overrides.header,
  };

  return {
    version: makeVersion(),
    responses: {},
    editable: true,
    truck: null,
    ...overrides,
    header,
  };
}

function makeSubmitResult(
  overrides: Partial<SubmitRecordResult> = {},
): SubmitRecordResult {
  return {
    recordId: "record-1",
    documentCode: "NMS/PPU/CL/24",
    recordNumber: "NMS/PPU/CL/24/20260714/ABC123",
    status: "SUBMITTED",
    submittedAt: "2026-07-14T02:00:00.000Z",
    counts: { acceptable: 3, failed: 0, notApplicable: 0, unanswered: 0, total: 3 },
    hasCriticalFailure: false,
    correctiveActionsCreated: 0,
    nextResponsibleRole: "FG_SUPERVISOR",
    loadingDecision: null,
    ...overrides,
  };
}

describe("InspectionRecordWorkspace — three-click happy path", () => {
  it("creates today's draft, marks all acceptable, reviews and submits, then shows the success screen", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "createCleaningDraft").mockResolvedValue(makeDetail());
    vi.spyOn(api, "saveInspectionDraft").mockResolvedValue(makeDetail());
    vi.spyOn(api, "submitInspectionRecord").mockResolvedValue(makeSubmitResult());

    render(<InspectionRecordWorkspace assignmentId="assign-1" />);

    await waitFor(() =>
      expect(screen.getByText("Daily Cleaning Verification")).toBeInTheDocument(),
    );
    expect(api.createCleaningDraft).toHaveBeenCalledWith({
      taskAssignmentId: "assign-1",
    });
    expect(
      screen.getByText(/Record #NMS\/PPU\/CL\/24\/20260714\/ABC123/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Jane Operator \(EMP-001\)/)).toBeInTheDocument();

    // 1st click — Mark All Acceptable.
    await user.click(
      screen.getByRole("button", { name: /mark all 3 items acceptable/i }),
    );

    // 2nd click — Review.
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Review before submitting")).toBeInTheDocument();

    // 3rd click — Submit.
    await user.click(
      screen.getByRole("button", { name: /submit cleaning verification/i }),
    );

    await waitFor(() =>
      expect(screen.getByText("Cleaning verification submitted")).toBeInTheDocument(),
    );
    expect(api.submitInspectionRecord).toHaveBeenCalledWith(
      "record-1",
      expect.objectContaining({
        responses: expect.objectContaining({
          fg_wall: expect.objectContaining({ value: { kind: "status", value: "PASS" } }),
        }),
      }),
    );
    expect(screen.getByText(/Next up: FG Supervisor review/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /return to today's tasks/i }),
    ).toHaveAttribute("href", "/tasks");
  });
});

describe("InspectionRecordWorkspace — required field validation", () => {
  it("keeps Submit disabled in review while a required item is unanswered", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "createCleaningDraft").mockResolvedValue(makeDetail());
    vi.spyOn(api, "saveInspectionDraft").mockResolvedValue(makeDetail());

    render(<InspectionRecordWorkspace />);

    await waitFor(() =>
      expect(screen.getByText("Daily Cleaning Verification")).toBeInTheDocument(),
    );

    // Skip Mark All Acceptable — go straight to Review with everything unanswered.
    await user.click(screen.getByRole("button", { name: "Review" }));

    const submitButton = screen.getByRole("button", {
      name: /submit cleaning verification/i,
    });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/items need attention/i)).toBeInTheDocument();
  });

  it("requires a remark once a remark-required item is marked Unacceptable", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "createCleaningDraft").mockResolvedValue(makeDetail());
    vi.spyOn(api, "saveInspectionDraft").mockResolvedValue(makeDetail());

    render(<InspectionRecordWorkspace />);
    await waitFor(() =>
      expect(screen.getByText("Daily Cleaning Verification")).toBeInTheDocument(),
    );

    const floorGroup = screen.getByRole("group", { name: "Floor result" });
    await user.click(within(floorGroup).getByRole("button", { name: "Unacceptable" }));

    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(
      screen.getByRole("button", { name: /describe why "floor" failed/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit cleaning verification/i }),
    ).toBeDisabled();
  });
});

describe("InspectionRecordWorkspace — duplicate prevention", () => {
  it("shows a friendly message and a way back to Today's Tasks on a 409 conflict", async () => {
    vi.spyOn(api, "createCleaningDraft").mockRejectedValue(
      new InspectionRecordApiError(
        409,
        "A record for this date, shift and area is already submitted.",
      ),
    );

    render(<InspectionRecordWorkspace />);

    await waitFor(() =>
      expect(screen.getByText("Already in progress")).toBeInTheDocument(),
    );
    expect(screen.getByText(/already submitted/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to today's tasks/i }),
    ).toBeInTheDocument();
  });
});

describe("InspectionRecordWorkspace — submission locking / read-only detail view", () => {
  it("hides Mark All Acceptable, Clear All and the sticky action bar once the record is no longer editable", async () => {
    vi.spyOn(api, "fetchInspectionRecord").mockResolvedValue(
      makeDetail({
        header: { status: "SUBMITTED", submittedAt: "2026-07-14T02:00:00.000Z" },
        editable: false,
      }),
    );

    render(<InspectionRecordWorkspace recordId="record-1" />);

    await waitFor(() =>
      expect(screen.getByText("Daily Cleaning Verification")).toBeInTheDocument(),
    );
    expect(api.fetchInspectionRecord).toHaveBeenCalledWith("record-1");
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review" })).not.toBeInTheDocument();
  });
});

describe("InspectionRecordWorkspace — draft saving", () => {
  it("autosaves responses to the API a short while after a change", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    vi.spyOn(api, "createCleaningDraft").mockResolvedValue(makeDetail());
    const saveSpy = vi.spyOn(api, "saveInspectionDraft").mockResolvedValue(makeDetail());

    render(<InspectionRecordWorkspace />);
    await waitFor(() =>
      expect(screen.getByText("Daily Cleaning Verification")).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: /mark all 3 items acceptable/i }),
    );

    await vi.advanceTimersByTimeAsync(1600);

    expect(saveSpy).toHaveBeenCalledWith(
      "record-1",
      expect.objectContaining({
        responses: expect.objectContaining({ fg_wall: expect.anything() }),
      }),
    );

    vi.useRealTimers();
  });
});
