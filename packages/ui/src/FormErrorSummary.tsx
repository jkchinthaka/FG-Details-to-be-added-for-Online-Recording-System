import { forwardRef } from "react";

export type FormErrorSummaryProps = {
  title?: string;
  errors: string[];
};

/** Form-level error list; focusable so screen readers land after submit. */
export const FormErrorSummary = forwardRef<HTMLDivElement, FormErrorSummaryProps>(
  function FormErrorSummary({ title = "Fix the following before continuing", errors }, ref) {
    if (errors.length === 0) return null;

    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        style={{
          borderRadius: "var(--nelna-radius)",
          border: "1px solid var(--nelna-danger)",
          background: "var(--nelna-danger-bg)",
          padding: "0.75rem",
        }}
      >
        <p
          style={{
            margin: "0 0 0.35rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--nelna-danger)",
          }}
        >
          {title}
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: "1.25rem",
            fontSize: "0.875rem",
            display: "grid",
            gap: "0.25rem",
          }}
        >
          {errors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  },
);
