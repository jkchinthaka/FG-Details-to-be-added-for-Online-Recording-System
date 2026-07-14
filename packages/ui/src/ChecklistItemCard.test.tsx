import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ITEM_RULES,
  type ChecklistItemDefinition,
  type ChecklistItemResponse,
} from "@nelna/shared";
import { ChecklistItemCard } from "./ChecklistItemCard";

function makeItem(
  overrides: Partial<ChecklistItemDefinition> = {},
): ChecklistItemDefinition {
  return {
    id: "item-1",
    label: "Floor is clean",
    sortOrder: 0,
    itemType: "ACCEPTABLE_UNACCEPTABLE_NA",
    options: [],
    ...DEFAULT_ITEM_RULES,
    ...overrides,
  };
}

describe("ChecklistItemCard — failure detail visibility", () => {
  it("does not render the failure detail panel when unanswered", () => {
    render(
      <ChecklistItemCard item={makeItem()} response={undefined} onChange={() => {}} />,
    );
    expect(screen.queryByText(/what failed/i)).toBeNull();
  });

  it("does not render the failure detail panel for a passing response", () => {
    const response: ChecklistItemResponse = {
      itemId: "item-1",
      value: { kind: "status", value: "PASS" },
    };
    render(
      <ChecklistItemCard item={makeItem()} response={response} onChange={() => {}} />,
    );
    expect(screen.queryByText(/what failed/i)).toBeNull();
  });

  it("renders the failure detail panel once the response is a failure", () => {
    const response: ChecklistItemResponse = {
      itemId: "item-1",
      value: { kind: "status", value: "FAIL" },
    };
    render(
      <ChecklistItemCard item={makeItem()} response={response} onChange={() => {}} />,
    );
    expect(screen.queryByText(/what failed/i)).not.toBeNull();
  });

  it("shows a critical failure marker only when isCriticalFailure and failing", () => {
    const response: ChecklistItemResponse = {
      itemId: "item-1",
      value: { kind: "status", value: "FAIL" },
    };
    render(
      <ChecklistItemCard
        item={makeItem({ isCriticalFailure: true })}
        response={response}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText("Critical failure")).not.toBeNull();
  });

  it("does not show the critical failure marker when passing, even if isCriticalFailure is set", () => {
    const response: ChecklistItemResponse = {
      itemId: "item-1",
      value: { kind: "status", value: "PASS" },
    };
    render(
      <ChecklistItemCard
        item={makeItem({ isCriticalFailure: true })}
        response={response}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText("Critical failure")).toBeNull();
  });

  it("marks remark/corrective action/evidence as required only per the item's configured rules", () => {
    const response: ChecklistItemResponse = {
      itemId: "item-1",
      value: { kind: "status", value: "FAIL" },
    };
    render(
      <ChecklistItemCard
        item={makeItem({
          remarkRequiredOnFail: true,
          correctiveActionRequiredOnFail: false,
        })}
        response={response}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText(/what failed\? \(required\)/i)).not.toBeNull();
    expect(screen.queryByText(/corrective action \(optional\)/i)).not.toBeNull();
  });

  it("hides the N/A option when allowNotApplicable is false", () => {
    render(
      <ChecklistItemCard
        item={makeItem({ allowNotApplicable: false })}
        response={undefined}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "N/A" })).toBeNull();
  });

  it("offers the N/A option when allowNotApplicable is true", () => {
    render(
      <ChecklistItemCard
        item={makeItem({ allowNotApplicable: true })}
        response={undefined}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "N/A" })).not.toBeNull();
  });

  it("preserves remark/evidence when the status flips away from FAIL (no silent data loss)", () => {
    const onChange = vi.fn();
    const response: ChecklistItemResponse = {
      itemId: "item-1",
      value: { kind: "status", value: "FAIL" },
      remark: "Grease build-up near drain",
    };
    render(
      <ChecklistItemCard item={makeItem()} response={response} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Acceptable" }));

    expect(onChange).toHaveBeenCalledWith({
      itemId: "item-1",
      value: { kind: "status", value: "PASS" },
      remark: "Grease build-up near drain",
    });
  });

  it("flags an out-of-range numeric reading as a failure and shows the range error", () => {
    const response: ChecklistItemResponse = {
      itemId: "item-1",
      value: { kind: "number", value: 12 },
    };
    render(
      <ChecklistItemCard
        item={makeItem({ itemType: "TEMPERATURE", minValue: -5, maxValue: 4 })}
        response={response}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText(/outside the allowed range/i)).not.toBeNull();
  });

  it("does not flag an in-range numeric reading", () => {
    const response: ChecklistItemResponse = {
      itemId: "item-1",
      value: { kind: "number", value: 2 },
    };
    render(
      <ChecklistItemCard
        item={makeItem({ itemType: "TEMPERATURE", minValue: -5, maxValue: 4 })}
        response={response}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText(/outside the allowed range/i)).toBeNull();
  });
});
