import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser, TodaysTasksResponse } from "@nelna/shared";
import * as authContext from "@/lib/auth/auth-context";
import * as useTodaysTasksModule from "@/lib/dashboard/useTodaysTasks";
import * as useRecentRecordsModule from "@/lib/dashboard/useRecentRecords";
import { TasksDashboard } from "./TasksDashboard";

function mockUser(overrides: Partial<CurrentUser>) {
  const user: CurrentUser = {
    id: "u1",
    employeeCode: "EMP-1",
    fullName: "Ada Lovelace",
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

function mockTasksResource(overrides: Partial<ReturnType<typeof useTodaysTasksModule.useTodaysTasks>>) {
  vi.spyOn(useTodaysTasksModule, "useTodaysTasks").mockReturnValue({
    status: "loading",
    data: null,
    error: null,
    retry: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useTodaysTasksModule.useTodaysTasks>);
}

function emptyTodaysTasks(overrides: Partial<TodaysTasksResponse> = {}): TodaysTasksResponse {
  return {
    generatedAt: "2026-07-14T00:00:00.000Z",
    roles: ["FG_OPERATOR"],
    summary: { completed: 0, pending: 0, attentionRequired: 0, totalCount: 0, completionPercent: 0 },
    tasks: [],
    complianceIndicators: [],
    adminShortcuts: [],
    ...overrides,
  };
}

describe("TasksDashboard", () => {
  beforeEach(() => {
    vi.spyOn(useRecentRecordsModule, "useRecentRecords").mockReturnValue({
      status: "success",
      data: { records: [] },
      error: null,
      retry: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a greeting using the current user's first name", () => {
    mockUser({ fullName: "Ada Lovelace" });
    mockTasksResource({ status: "loading" });

    render(<TasksDashboard />);

    expect(screen.getByText(/Ada/)).toBeInTheDocument();
  });

  it("shows loading skeletons before the tasks payload resolves", () => {
    mockUser({});
    mockTasksResource({ status: "loading" });

    render(<TasksDashboard />);

    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("shows an error banner with a retry action when today's tasks fail to load", () => {
    const retry = vi.fn();
    mockUser({});
    mockTasksResource({ status: "error", error: "Server unavailable", retry });

    render(<TasksDashboard />);

    expect(screen.getByText("Couldn't load today's tasks")).toBeInTheDocument();
    expect(screen.getByText("Server unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the empty task state for an operator with nothing assigned today", () => {
    mockUser({ roles: ["FG_OPERATOR"] });
    mockTasksResource({ status: "success", data: emptyTodaysTasks() });

    render(<TasksDashboard />);

    expect(screen.getByText("No tasks for today")).toBeInTheDocument();
  });

  it("renders the Food Safety Team Leader's compliance snapshot but no admin shortcuts", () => {
    mockUser({ roles: ["FOOD_SAFETY_TEAM_LEADER"] });
    mockTasksResource({
      status: "success",
      data: emptyTodaysTasks({
        roles: ["FOOD_SAFETY_TEAM_LEADER"],
        complianceIndicators: [{ id: "verified-today", label: "Verified today", value: "3/5", tone: "information" }],
      }),
    });

    render(<TasksDashboard />);

    expect(screen.getByText("Compliance snapshot")).toBeInTheDocument();
    expect(screen.getByText("Verified today")).toBeInTheDocument();
    expect(screen.queryByText("Admin shortcuts")).not.toBeInTheDocument();
  });

  it("renders the System Administrator's shortcuts widget", () => {
    mockUser({ roles: ["SYSTEM_ADMINISTRATOR"] });
    mockTasksResource({
      status: "success",
      data: emptyTodaysTasks({
        roles: ["SYSTEM_ADMINISTRATOR"],
        adminShortcuts: [
          { id: "system-status", label: "System status", description: "API and database health", href: "/system-status" },
        ],
      }),
    });

    render(<TasksDashboard />);

    expect(screen.getByText("Admin shortcuts")).toBeInTheDocument();
    expect(screen.getByText("System status")).toBeInTheDocument();
  });

  it("renders an operator's own assigned task cards with their next action", () => {
    mockUser({ roles: ["FG_OPERATOR"] });
    mockTasksResource({
      status: "success",
      data: emptyTodaysTasks({
        summary: { completed: 0, pending: 1, attentionRequired: 0, totalCount: 1, completionPercent: 0 },
        tasks: [
          {
            id: "assignment-1",
            title: "Daily Cleaning Verification",
            subtitle: "NMS/PPU/CL/24 · Morning",
            documentCode: "NMS/PPU/CL/24",
            recordType: "DAILY_CLEANING_VERIFICATION",
            areaLabel: "Finished Goods + Changing Room",
            shiftLabel: "Morning",
            status: "ASSIGNED",
            bucket: "pending",
            action: "START",
            href: "/records/cleaning",
          },
        ],
      }),
    });

    render(<TasksDashboard />);

    expect(screen.getByText("Daily Cleaning Verification")).toBeInTheDocument();
    expect(screen.getByText("Start →")).toBeInTheDocument();
  });
});
