import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SegmentedStatusSelector,
  type SegmentedStatusOption,
} from "./SegmentedStatusSelector";

type Result = "ACCEPTABLE" | "FAIL";

const options: Array<SegmentedStatusOption<Result>> = [
  { value: "ACCEPTABLE", label: "Acceptable", tone: "success" },
  { value: "FAIL", label: "Fail", tone: "danger" },
];

describe("SegmentedStatusSelector", () => {
  it("calls onChange with the selected option's value", () => {
    const onChange = vi.fn();
    render(
      <SegmentedStatusSelector
        label="Wall"
        value={null}
        options={options}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fail" }));

    expect(onChange).toHaveBeenCalledWith("FAIL");
  });

  it("marks only the selected option as pressed", () => {
    render(
      <SegmentedStatusSelector
        label="Wall"
        value="ACCEPTABLE"
        options={options}
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Acceptable" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Fail" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("disables every option and surfaces an error message", () => {
    render(
      <SegmentedStatusSelector
        label="Wall"
        value={null}
        options={options}
        onChange={() => {}}
        disabled
        error="Select a result"
      />,
    );

    const acceptable = screen.getByRole("button", {
      name: "Acceptable",
    }) as HTMLButtonElement;
    expect(acceptable.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Select a result");
  });
});
