import type { SelectHTMLAttributes } from "react";
import { slugify } from "./internal/slugify";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
  placeholder?: string;
};

/** Native select styled to match Nelna form controls (48px touch target). */
export function Select({
  label,
  options,
  hint,
  error,
  placeholder,
  className,
  id,
  ...rest
}: SelectProps) {
  const selectId = id ?? `nelna-select-${slugify(label)}`;

  return (
    <div className="nelna-field">
      <label htmlFor={selectId} className="nelna-field-label">
        {label}
      </label>
      <select
        id={selectId}
        className={[
          "nelna-control",
          "nelna-focusable",
          error ? "nelna-control-invalid" : null,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={Boolean(error)}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error ? <p className="nelna-field-hint">{hint}</p> : null}
      {error ? (
        <p role="alert" className="nelna-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
