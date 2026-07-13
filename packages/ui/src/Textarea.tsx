import type { TextareaHTMLAttributes } from "react";
import { slugify } from "./internal/slugify";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
};

/** Multi-line text field, used for failure notes and corrective action detail. */
export function Textarea({
  label,
  hint,
  error,
  hideLabel = false,
  className,
  id,
  rows = 3,
  ...rest
}: TextareaProps) {
  const textareaId = id ?? `nelna-textarea-${slugify(label)}`;

  return (
    <div className="nelna-field">
      <label
        htmlFor={textareaId}
        className={hideLabel ? "nelna-sr-only" : "nelna-field-label"}
      >
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
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
      />
      {hint && !error ? <p className="nelna-field-hint">{hint}</p> : null}
      {error ? (
        <p role="alert" className="nelna-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
