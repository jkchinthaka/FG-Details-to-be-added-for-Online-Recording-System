import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeAll } from "vitest";
import {
  DEFAULT_ITEM_RULES,
  type ChecklistItemDefinition,
  type ChecklistResponseMap,
  type ChecklistTemplateVersionDefinition,
} from "@nelna/shared";
import { ChecklistRenderer } from "./ChecklistRenderer";

beforeAll(() => {
  // jsdom does not implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

function item(overrides: Partial<ChecklistItemDefinition>): ChecklistItemDefinition {
  return {
    id: "item",
    label: "Item",
    sortOrder: 0,
    itemType: "ACCEPTABLE_UNACCEPTABLE_NA",
    options: [],
    ...DEFAULT_ITEM_RULES,
    ...overrides,
  };
}

function makeVersion(): ChecklistTemplateVersionDefinition {
  return {
    id: "version-1",
    templateId: "template-1",
    code: "NMS/PPU/CL/24",
    title: "Daily Cleaning",
    versionNumber: 1,
    status: "PUBLISHED",
    sections: [
      {
        id: "section-1",
        name: "Floors & Walls",
        sortOrder: 0,
        items: [
          item({ id: "item-1", label: "Floor clean", sortOrder: 0 }),
          item({ id: "item-2", label: "Wall clean", sortOrder: 1 }),
        ],
      },
      {
        id: "section-2",
        name: "Cold storage",
        sortOrder: 1,
        items: [
          item({ id: "item-3", label: "Cold room already failed", sortOrder: 0, isCriticalFailure: true }),
          item({ id: "item-4", label: "Remark required item", sortOrder: 1, remarkRequiredOnFail: true }),
        ],
      },
    ],
  };
}

describe("ChecklistRenderer — Mark All Acceptable", () => {
  it("fills only unanswered eligible items and leaves an existing failure untouched", () => {
    const version = makeVersion();
    const responses: ChecklistResponseMap = {
      "item-3": { itemId: "item-3", value: { kind: "status", value: "FAIL" }, remark: "Compressor fault" },
    };
    const onResponsesChange = vi.fn();

    render(<ChecklistRenderer version={version} responses={responses} onResponsesChange={onResponsesChange} />);

    fireEvent.click(screen.getByRole("button", { name: /mark all 3 items acceptable/i }));

    const next = onResponsesChange.mock.calls[0][0] as ChecklistResponseMap;
    expect(next["item-1"]).toEqual({ itemId: "item-1", value: { kind: "status", value: "PASS" } });
    expect(next["item-2"]).toEqual({ itemId: "item-2", value: { kind: "status", value: "PASS" } });
    expect(next["item-4"]).toEqual({ itemId: "item-4", value: { kind: "status", value: "PASS" } });
    // The existing manual failure — including its remark — must survive untouched.
    expect(next["item-3"]).toEqual(responses["item-3"]);
  });

  it("disables Mark All once every eligible item already has an answer", () => {
    const version = makeVersion();
    const responses: ChecklistResponseMap = {
      "item-1": { itemId: "item-1", value: { kind: "status", value: "PASS" } },
      "item-2": { itemId: "item-2", value: { kind: "status", value: "PASS" } },
      "item-3": { itemId: "item-3", value: { kind: "status", value: "FAIL" } },
      "item-4": { itemId: "item-4", value: { kind: "status", value: "PASS" } },
    };

    render(<ChecklistRenderer version={version} responses={responses} onResponsesChange={() => {}} />);

    const button = screen.getByRole("button", { name: /mark all 0 items acceptable/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("surfaces a critical failure banner when a critical item is failing", () => {
    const version = makeVersion();
    const responses: ChecklistResponseMap = {
      "item-3": { itemId: "item-3", value: { kind: "status", value: "FAIL" } },
    };
    render(<ChecklistRenderer version={version} responses={responses} onResponsesChange={() => {}} />);
    expect(screen.queryByText(/critical failure detected/i)).not.toBeNull();
  });

  it("does not surface a critical failure banner when the critical item is unanswered", () => {
    const version = makeVersion();
    render(<ChecklistRenderer version={version} responses={{}} onResponsesChange={() => {}} />);
    expect(screen.queryByText(/critical failure detected/i)).toBeNull();
  });
});

describe("ChecklistRenderer — Clear All", () => {
  it("requires confirmation before clearing, and never clears on cancel", () => {
    const version = makeVersion();
    const responses: ChecklistResponseMap = {
      "item-1": { itemId: "item-1", value: { kind: "status", value: "PASS" } },
    };
    const onResponsesChange = vi.fn();
    render(<ChecklistRenderer version={version} responses={responses} onResponsesChange={onResponsesChange} />);

    fireEvent.click(screen.getByRole("button", { name: /clear all responses/i }));
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onResponsesChange).not.toHaveBeenCalled();
  });

  it("clears every response once the destructive action is confirmed", () => {
    const version = makeVersion();
    const responses: ChecklistResponseMap = {
      "item-1": { itemId: "item-1", value: { kind: "status", value: "PASS" } },
    };
    const onResponsesChange = vi.fn();
    render(<ChecklistRenderer version={version} responses={responses} onResponsesChange={onResponsesChange} />);

    fireEvent.click(screen.getByRole("button", { name: /clear all responses/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onResponsesChange).toHaveBeenCalledWith({});
  });

  it("disables Clear All when there is nothing recorded yet", () => {
    const version = makeVersion();
    render(<ChecklistRenderer version={version} responses={{}} onResponsesChange={() => {}} />);
    const button = screen.getByRole("button", { name: /clear all responses/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe("ChecklistRenderer — dynamic validation", () => {
  it("lists a required-response error in the jump-to summary once enabled", () => {
    const version = makeVersion();
    render(<ChecklistRenderer version={version} responses={{}} onResponsesChange={() => {}} showValidationSummary />);

    // The summary renders each error as a clickable jump-to-item button.
    expect(screen.getByRole("button", { name: /"Floor clean" requires a response/i })).toBeTruthy();
  });

  it("does not render the validation summary (or inline errors) unless the caller opts in", () => {
    const version = makeVersion();
    render(<ChecklistRenderer version={version} responses={{}} onResponsesChange={() => {}} />);
    expect(screen.queryByText(/requires a response/i)).toBeNull();
  });

  it("lists a remark-required error once a remark-required item is failing without a remark", () => {
    const version = makeVersion();
    const responses: ChecklistResponseMap = {
      "item-4": { itemId: "item-4", value: { kind: "status", value: "FAIL" } },
    };
    render(
      <ChecklistRenderer version={version} responses={responses} onResponsesChange={() => {}} showValidationSummary />,
    );

    expect(
      screen.getByRole("button", { name: /describe why "remark required item" failed/i }),
    ).toBeTruthy();
  });

  it("clears the remark-required error once a remark is recorded for the failing item", () => {
    const version = makeVersion();
    const responses: ChecklistResponseMap = {
      "item-4": { itemId: "item-4", value: { kind: "status", value: "FAIL" }, remark: "Grease trap overdue" },
    };
    render(
      <ChecklistRenderer version={version} responses={responses} onResponsesChange={() => {}} showValidationSummary />,
    );

    expect(screen.queryByRole("button", { name: /describe why "remark required item" failed/i })).toBeNull();
  });
});
