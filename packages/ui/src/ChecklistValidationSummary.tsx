import type { ChecklistValidationError } from "@nelna/shared";
import { Alert } from "./Alert";

export type ChecklistValidationSummaryProps = {
  errors: ChecklistValidationError[];
  /** Optional jump-to-item behaviour (e.g. scroll + focus in the renderer). */
  onFocusItem?: (itemId: string) => void;
};

/** Rolls up every outstanding validation error so an operator can see —
 *  and jump to — everything blocking submission in one place. */
export function ChecklistValidationSummary({ errors, onFocusItem }: ChecklistValidationSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <Alert tone="danger" title={`${errors.length} item${errors.length === 1 ? "" : "s"} need attention`}>
      <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.25rem" }}>
        {errors.map((error, index) => (
          <li key={`${error.itemId}-${error.code}-${index}`}>
            {onFocusItem ? (
              <button
                type="button"
                onClick={() => onFocusItem(error.itemId)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                  textAlign: "left",
                }}
              >
                {error.message}
              </button>
            ) : (
              error.message
            )}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
