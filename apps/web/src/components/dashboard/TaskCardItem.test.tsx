import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskCard } from "@nelna/shared";
import { TaskCardItem } from "./TaskCardItem";

function makeTask(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
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
    ...overrides,
  };
}

describe("TaskCardItem", () => {
  it("renders the title, document code, status and next action", () => {
    render(<TaskCardItem task={makeTask()} />);

    expect(screen.getByText("Daily Cleaning Verification")).toBeInTheDocument();
    expect(screen.getByText("NMS/PPU/CL/24")).toBeInTheDocument();
    expect(screen.getByText("Assigned")).toBeInTheDocument();
    expect(screen.getByText("Start →")).toBeInTheDocument();
  });

  it("links to the task's href", () => {
    render(<TaskCardItem task={makeTask({ href: "/records/freezer-truck" })} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/records/freezer-truck");
  });

  it("shows Continue for an in-progress task and Review for a submitted one", () => {
    const { rerender } = render(
      <TaskCardItem
        task={makeTask({ status: "IN_PROGRESS", action: "CONTINUE", bucket: "pending" })}
      />,
    );
    expect(screen.getByText("Continue →")).toBeInTheDocument();

    rerender(
      <TaskCardItem
        task={makeTask({ status: "SUBMITTED", action: "REVIEW", bucket: "completed" })}
      />,
    );
    expect(screen.getByText("Review →")).toBeInTheDocument();
  });

  it("falls back to the raw template code as a title when the record type is unknown", () => {
    render(
      <TaskCardItem
        task={makeTask({
          title: "NMS/PPU/CL/99",
          recordType: null,
          documentCode: "NMS/PPU/CL/99",
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "NMS/PPU/CL/99" })).toBeInTheDocument();
  });
});
