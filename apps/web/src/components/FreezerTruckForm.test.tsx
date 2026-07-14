import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  ChecklistTemplateVersionDefinition,
  CurrentUser,
  InspectionRecordDetail,
  SubmitRecordResult,
  TruckInspectionDetailPayload,
  VehicleSearchResponse,
} from "@nelna/shared";
import { DEFAULT_ITEM_RULES } from "@nelna/shared";
import * as authContext from "@/lib/auth/auth-context";
import * as inspectionApi from "@/lib/inspection-records/api";
import * as vehiclesApi from "@/lib/vehicles/api";
import { FreezerTruckForm } from "./FreezerTruckForm";

beforeAll(() => {
  // jsdom does not implement scrollIntoView, which ChecklistRenderer calls
  // when jumping to a failing item from the validation summary.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function mockUser(overrides: Partial<CurrentUser> = {}) {
  const user: CurrentUser = {
    id: "u1",
    employeeCode: "EMP-1",
    fullName: "Jane Operator",
    email: null,
    status: "ACTIVE",
    roles: ["FG_OPERATOR"],
    permissions: [],
    lastLoginAt: null,
    ...overrides,
  };
  vi.spyOn(authContext, "useAuth").mockReturnValue({
    status: "authenticated",
    user,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
    sessionExpiredNotice: false,
    clearSessionExpiredNotice: vi.fn(),
    canOpenPath: () => true,
  });
}

function makeVersion(): ChecklistTemplateVersionDefinition {
  return {
    id: "version-30",
    templateId: "template-30",
    code: "NMS/PPU/CL/30",
    title: "Inspection of Freezer Truck Before Loading",
    versionNumber: 1,
    status: "PUBLISHED",
    sections: [
      {
        id: "section-truck",
        name: "Pre-loading checks",
        sortOrder: 0,
        items: [
          { ...DEFAULT_ITEM_RULES, id: "overall_cleanliness", label: "Overall cleanliness", helpText: null, sortOrder: 0, itemType: "PASS_FAIL_NA", options: [] },
          { ...DEFAULT_ITEM_RULES, id: "door_lock", label: "Door lock", helpText: null, sortOrder: 1, itemType: "PASS_FAIL_NA", options: [], isCriticalFailure: true },
        ],
      },
    ],
  };
}

function makeTruckDetail(overrides: Partial<TruckInspectionDetailPayload> = {}): TruckInspectionDetailPayload {
  return {
    vehicle: { id: "vehicle-1", vehicleNumber: "MH-12 AB 3456", freezerTruckNumber: "FT-01", status: "ACTIVE", transporter: { id: "t1", name: "Nelna Logistics" } },
    driver: null,
    transporter: { id: "t1", name: "Nelna Logistics" },
    freezerTruckNumber: "FT-01",
    vehicleNumber: "MH-12 AB 3456",
    inspectionTime: "08:30",
    loadingReference: null,
    productCategory: null,
    temperature: { current: null, min: null, max: null, acceptable: null },
    recommendedDecision: null,
    loadingDecision: "PENDING",
    decidedBy: null,
    decidedAt: null,
    remarks: null,
    reinspectionOf: null,
    ...overrides,
  };
}

type DetailOverrides = Partial<Omit<InspectionRecordDetail, "header">> & {
  header?: Partial<InspectionRecordDetail["header"]>;
};

function makeDetail(overrides: DetailOverrides = {}): InspectionRecordDetail {
  const header: InspectionRecordDetail["header"] = {
    id: "record-truck-1",
    documentCode: "NMS/PPU/CL/30",
    recordNumber: "NMS/PPU/CL/30/20260714/TRK001",
    templateTitle: "Inspection of Freezer Truck Before Loading",
    templateVersionNumber: 1,
    status: "DRAFT",
    recordDate: "2026-07-14",
    recordMonth: "July 2026",
    shiftLabel: "Morning",
    areaLabel: "Dispatch bay",
    recordedBy: { id: "u1", fullName: "Jane Operator", employeeCode: "EMP-001" },
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
    truck: makeTruckDetail(),
    ...overrides,
    header,
  };
}

function makeSubmitResult(overrides: Partial<SubmitRecordResult> = {}): SubmitRecordResult {
  return {
    recordId: "record-truck-1",
    documentCode: "NMS/PPU/CL/30",
    recordNumber: "NMS/PPU/CL/30/20260714/TRK001",
    status: "SUBMITTED",
    submittedAt: "2026-07-14T02:00:00.000Z",
    counts: { acceptable: 2, failed: 0, notApplicable: 0, unanswered: 0, total: 2 },
    hasCriticalFailure: false,
    correctiveActionsCreated: 0,
    nextResponsibleRole: "FG_SUPERVISOR",
    loadingDecision: "APPROVED_FOR_LOADING",
    ...overrides,
  };
}

function makeVehicleSearchResponse(overrides: Partial<VehicleSearchResponse> = {}): VehicleSearchResponse {
  return {
    vehicles: [
      { id: "vehicle-1", vehicleNumber: "MH-12 AB 3456", freezerTruckNumber: "FT-01", status: "ACTIVE", transporter: { id: "t1", name: "Nelna Logistics" } },
    ],
    isRecent: true,
    ...overrides,
  };
}

describe("FreezerTruckForm — vehicle selection then submit", () => {
  it("selects a recent vehicle, marks all conditions passed, reviews and submits", async () => {
    mockUser();
    const user = userEvent.setup();
    vi.spyOn(vehiclesApi, "searchVehicles").mockResolvedValue(makeVehicleSearchResponse());
    vi.spyOn(inspectionApi, "createTruckDraft").mockResolvedValue(makeDetail());
    vi.spyOn(inspectionApi, "saveInspectionDraft").mockResolvedValue(makeDetail());
    vi.spyOn(inspectionApi, "submitInspectionRecord").mockResolvedValue(makeSubmitResult());

    render(<FreezerTruckForm assignmentId="assign-2" />);

    await waitFor(() => expect(screen.getByText("Recent vehicles")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /MH-12 AB 3456/i }));
    await user.click(screen.getByRole("button", { name: /continue to inspection/i }));

    await waitFor(() => expect(screen.getByText("Inspection of Freezer Truck Before Loading")).toBeInTheDocument());
    expect(inspectionApi.createTruckDraft).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: "vehicle-1", taskAssignmentId: "assign-2" }),
    );
    expect(screen.getByText("MH-12 AB 3456")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mark all 2 items acceptable/i }));
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Review before submitting")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /submit freezer truck inspection/i }));

    await waitFor(() => expect(screen.getByText("Freezer truck inspection submitted")).toBeInTheDocument());
    expect(screen.getByText("Approved for loading")).toBeInTheDocument();
  });

  it("hides manual entry for a user without the vehicles:manual_entry permission", async () => {
    mockUser({ permissions: [] });
    vi.spyOn(vehiclesApi, "searchVehicles").mockResolvedValue(makeVehicleSearchResponse());

    render(<FreezerTruckForm />);

    await waitFor(() => expect(screen.getByText("Recent vehicles")).toBeInTheDocument());
    expect(screen.queryByText(/enter truck & vehicle number manually/i)).not.toBeInTheDocument();
  });

  it("allows manual entry for a user holding vehicles:manual_entry", async () => {
    mockUser({ permissions: ["vehicles:manual_entry"] });
    const user = userEvent.setup();
    vi.spyOn(vehiclesApi, "searchVehicles").mockResolvedValue(makeVehicleSearchResponse({ vehicles: [], isRecent: true }));
    vi.spyOn(inspectionApi, "createTruckDraft").mockResolvedValue(
      makeDetail({ truck: makeTruckDetail({ vehicle: null, freezerTruckNumber: "FT-99", vehicleNumber: "GJ-05 CD 1122" }) }),
    );

    render(<FreezerTruckForm />);

    await waitFor(() => expect(screen.getByText(/enter truck & vehicle number manually/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /enter truck & vehicle number manually/i }));
    await user.type(screen.getByLabelText("Freezer truck number"), "FT-99");
    await user.type(screen.getByLabelText("Vehicle number"), "GJ-05 CD 1122");
    await user.click(screen.getByRole("button", { name: /continue to inspection/i }));

    await waitFor(() =>
      expect(inspectionApi.createTruckDraft).toHaveBeenCalledWith(
        expect.objectContaining({ freezerTruckNumber: "FT-99", vehicleNumber: "GJ-05 CD 1122" }),
      ),
    );
  });
});

describe("FreezerTruckForm — read-only detail with loading decision panel", () => {
  it("shows the recommended decision and a critical-failure warning, read-only for a viewer without approval permission", async () => {
    mockUser({ roles: ["FG_SUPERVISOR"], permissions: [] });
    vi.spyOn(inspectionApi, "fetchInspectionRecord").mockResolvedValue(
      makeDetail({
        header: { status: "SUBMITTED", submittedAt: "2026-07-14T02:00:00.000Z" },
        editable: false,
        truck: makeTruckDetail({ recommendedDecision: "LOADING_BLOCKED", loadingDecision: "LOADING_BLOCKED" }),
      }),
    );

    render(<FreezerTruckForm recordId="record-truck-1" />);

    await waitFor(() => expect(screen.getByText("Loading decision")).toBeInTheDocument());
    expect(screen.getByText(/critical failure — loading cannot be approved/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record decision/i })).not.toBeInTheDocument();
  });

  it("lets a supervisor/QA holding loading_decisions:approve record the final decision", async () => {
    mockUser({ roles: ["FG_SUPERVISOR"], permissions: ["loading_decisions:approve"] });
    const user = userEvent.setup();
    const submittedDetail = makeDetail({
      header: { status: "SUBMITTED", submittedAt: "2026-07-14T02:00:00.000Z" },
      editable: false,
      truck: makeTruckDetail({ recommendedDecision: "CONDITIONALLY_APPROVED", loadingDecision: "CONDITIONALLY_APPROVED" }),
    });
    vi.spyOn(inspectionApi, "fetchInspectionRecord").mockResolvedValue(submittedDetail);
    const recordDecisionSpy = vi.spyOn(inspectionApi, "recordLoadingDecision").mockResolvedValue(
      makeDetail({
        header: { status: "SUBMITTED", submittedAt: "2026-07-14T02:00:00.000Z" },
        editable: false,
        truck: makeTruckDetail({
          recommendedDecision: "CONDITIONALLY_APPROVED",
          loadingDecision: "APPROVED_FOR_LOADING",
          decidedBy: { id: "sup-1", fullName: "Sam Supervisor", employeeCode: "EMP-SUP" },
          decidedAt: "2026-07-14T03:00:00.000Z",
        }),
      }),
    );

    render(<FreezerTruckForm recordId="record-truck-1" />);

    await waitFor(() => expect(screen.getByText("Record final decision")).toBeInTheDocument());
    const panel = screen.getByText("Record final decision").closest("div")!;
    await user.click(within(panel.parentElement as HTMLElement).getByRole("button", { name: "Approved for loading" }));
    await user.click(screen.getByRole("button", { name: /record decision/i }));

    await waitFor(() =>
      expect(recordDecisionSpy).toHaveBeenCalledWith(
        "record-truck-1",
        expect.objectContaining({ decision: "APPROVED_FOR_LOADING" }),
      ),
    );
    await waitFor(() => expect(screen.getByText(/Decided by Sam Supervisor/)).toBeInTheDocument());
  });
});
