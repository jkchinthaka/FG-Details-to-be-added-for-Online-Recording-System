import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as useRecentRecordsModule from "@/lib/dashboard/useRecentRecords";
import { RecentRecordsSection } from "./RecentRecordsSection";

function mockResource(
  overrides: Partial<ReturnType<typeof useRecentRecordsModule.useRecentRecords>>,
) {
  vi.spyOn(useRecentRecordsModule, "useRecentRecords").mockReturnValue({
    status: "loading",
    data: null,
    error: null,
    retry: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useRecentRecordsModule.useRecentRecords>);
}

describe("RecentRecordsSection", () => {
  it("renders skeleton rows while loading", () => {
    mockResource({ status: "loading", data: null, error: null });
    render(<RecentRecordsSection />);
    expect(screen.getByText("Recent records")).toBeInTheDocument();
  });

  it("shows an empty state when there are no records", () => {
    mockResource({ status: "success", data: { records: [] }, error: null });
    render(<RecentRecordsSection />);
    expect(screen.getByText("No records yet")).toBeInTheDocument();
  });

  it("renders each record's title, document code and status", () => {
    mockResource({
      status: "success",
      error: null,
      data: {
        records: [
          {
            id: "r1",
            documentCode: "NMS/PPU/CL/24",
            title: "Daily Cleaning Verification",
            status: "VERIFIED",
            areaLabel: "Finished Goods",
            submittedAt: "2026-07-14T02:00:00.000Z",
            updatedAt: "2026-07-14T03:00:00.000Z",
          },
        ],
      },
    });
    render(<RecentRecordsSection />);

    expect(screen.getByText("Daily Cleaning Verification")).toBeInTheDocument();
    expect(screen.getByText(/NMS\/PPU\/CL\/24/)).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("shows an error banner with a working retry button", () => {
    const retry = vi.fn();
    mockResource({ status: "error", data: null, error: "Network down", retry });
    render(<RecentRecordsSection />);

    expect(screen.getByText("Couldn't load recent records")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
