import { forwardRef, type InputHTMLAttributes } from "react";
import { slugify } from "./internal/slugify";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
};

/** Single-line text field with label, hint and error slots. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel = false, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `nelna-input-${slugify(label)}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="nelna-field">
      <label
        htmlFor={inputId}
        className={hideLabel ? "nelna-sr-only" : "nelna-field-label"}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={[
          "nelna-control",
          "nelna-focusable",
          error ? "nelna-control-invalid" : null,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="nelna-field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="nelna-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
