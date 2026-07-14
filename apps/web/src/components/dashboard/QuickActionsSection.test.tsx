import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuickActionsSection } from "./QuickActionsSection";

describe("QuickActionsSection", () => {
  it("shows all three quick actions for an FG Operator", () => {
    render(<QuickActionsSection roles={["FG_OPERATOR"]} />);

    expect(screen.getByText("Start Daily Cleaning")).toBeInTheDocument();
    expect(screen.getByText("Inspect Freezer Truck")).toBeInTheDocument();
    expect(screen.getByText("View My Records")).toBeInTheDocument();
  });

  it("hides record-creation actions but keeps View My Records for a QA Executive", () => {
    render(<QuickActionsSection roles={["QA_EXECUTIVE"]} />);

    expect(screen.queryByText("Start Daily Cleaning")).not.toBeInTheDocument();
    expect(screen.queryByText("Inspect Freezer Truck")).not.toBeInTheDocument();
    expect(screen.getByText("View My Records")).toBeInTheDocument();
  });

  it("renders nothing for a role with no visible quick actions", () => {
    const { container } = render(
      <QuickActionsSection roles={["SYSTEM_ADMINISTRATOR"]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
