import type { InputHTMLAttributes } from "react";
import { slugify } from "./internal/slugify";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

/**
 * Checkbox for secondary, multi-select choices only (e.g. "notify supervisor").
 * Primary Acceptable / Fail decisions should use `SegmentedStatusSelector`
 * instead — see docs/DESIGN_SYSTEM.md.
 */
export function Checkbox({ label, className, id, ...rest }: CheckboxProps) {
  const checkboxId = id ?? `nelna-checkbox-${slugify(label)}`;

  return (
    <label
      htmlFor={checkboxId}
      className={["nelna-checkbox", "nelna-focusable", className]
        .filter(Boolean)
        .join(" ")}
    >
      <input id={checkboxId} type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}
