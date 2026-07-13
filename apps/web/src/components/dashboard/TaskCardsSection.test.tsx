import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskCard } from "@nelna/shared";
import { TaskCardsSection } from "./TaskCardsSection";

function makeTask(overrides: Partial<TaskCard>): TaskCard {
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Daily Cleaning Verification",
    subtitle: "NMS/PPU/CL/24",
    documentCode: "NMS/PPU/CL/24",
    recordType: "DAILY_CLEANING_VERIFICATION",
    areaLabel: "Finished Goods",
    shiftLabel: "Morning",
    status: "ASSIGNED",
    bucket: "pending",
    action: "START",
    href: "/records/cleaning",
    ...overrides,
  };
}

describe("TaskCardsSection", () => {
  it("shows an empty state when there are no tasks", () => {
    render(<TaskCardsSection tasks={[]} />);
    expect(screen.getByText("No tasks for today")).toBeInTheDocument();
  });

  it("groups tasks under Needs attention, Pending and Completed headings, attention first", () => {
    const tasks = [
      makeTask({ id: "a", title: "Completed one", bucket: "completed", status: "VERIFIED" }),
      makeTask({ id: "b", title: "Attention one", bucket: "attention", status: "REJECTED" }),
      makeTask({ id: "c", title: "Pending one", bucket: "pending", status: "ASSIGNED" }),
    ];

    render(<TaskCardsSection tasks={tasks} />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual(["Needs attention", "Pending", "Completed"]);

    expect(screen.getByText("Attention one")).toBeInTheDocument();
    expect(screen.getByText("Pending one")).toBeInTheDocument();
    expect(screen.getByText("Completed one")).toBeInTheDocument();
  });

  it("omits a bucket heading entirely when it has no tasks", () => {
    render(<TaskCardsSection tasks={[makeTask({ id: "a", bucket: "pending" })]} />);

    expect(screen.getByRole("heading", { name: "Pending" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Needs attention" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Completed" })).not.toBeInTheDocument();
  });
});
