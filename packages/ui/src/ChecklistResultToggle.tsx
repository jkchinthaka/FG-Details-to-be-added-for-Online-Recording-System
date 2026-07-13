import type { CheckItemResult } from "@nelna/shared";
import type { CSSProperties, ChangeEvent } from "react";

export type ChecklistResultToggleProps = {
  itemId: string;
  label: string;
  value: CheckItemResult | null;
  onChange: (value: CheckItemResult) => void;
  failureNote?: string;
  onFailureNoteChange?: (note: string) => void;
  correctiveAction?: string;
  onCorrectiveActionChange?: (note: string) => void;
  showCorrectiveAction?: boolean;
  error?: string;
};

/**
 * Exception-first checklist row: Acceptable / Fail with failure fields
 * revealed only after Fail is selected.
 */
export function ChecklistResultToggle({
  itemId,
  label,
  value,
  onChange,
  failureNote = "",
  onFailureNoteChange,
  correctiveAction = "",
  onCorrectiveActionChange,
  showCorrectiveAction = false,
  error,
}: ChecklistResultToggleProps) {
  const failed = value === "FAIL";

  return (
    <div
      style={{
        padding: "1rem",
        borderBottom: "1px solid var(--nelna-border)",
        background: failed ? "var(--nelna-danger-bg)" : "var(--nelna-surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--nelna-font-sans)",
            fontWeight: 600,
            fontSize: "1.05rem",
            color: "var(--nelna-text)",
          }}
        >
          {label}
        </span>
        <div
          role="group"
          aria-label={`${label} result`}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}
        >
          <ResultChoice
            name={itemId}
            label="Acceptable"
            selected={value === "ACCEPTABLE"}
            tone="success"
            onSelect={() => onChange("ACCEPTABLE")}
          />
          <ResultChoice
            name={itemId}
            label="Fail"
            selected={value === "FAIL"}
            tone="danger"
            onSelect={() => onChange("FAIL")}
          />
        </div>
      </div>

      {failed ? (
        <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem" }}>
          <label style={fieldLabelStyle}>
            What failed?
            <textarea
              value={failureNote}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                onFailureNoteChange?.(e.target.value)
              }
              rows={2}
              style={textareaStyle}
              aria-invalid={Boolean(error)}
            />
          </label>
          {showCorrectiveAction ? (
            <label style={fieldLabelStyle}>
              Corrective action
              <textarea
                value={correctiveAction}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  onCorrectiveActionChange?.(e.target.value)
                }
                rows={2}
                style={textareaStyle}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          style={{
            margin: "0.5rem 0 0",
            color: "var(--nelna-danger)",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ResultChoice({
  name,
  label,
  selected,
  tone,
  onSelect,
}: {
  name: string;
  label: string;
  selected: boolean;
  tone: "success" | "danger";
  onSelect: () => void;
}) {
  const activeBg =
    tone === "success" ? "var(--nelna-success-bg)" : "var(--nelna-danger-bg)";
  const activeBorder =
    tone === "success" ? "var(--nelna-success)" : "var(--nelna-danger)";

  return (
    <button
      type="button"
      name={name}
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        minHeight: "var(--nelna-touch-min)",
        borderRadius: "var(--nelna-radius)",
        border: `2px solid ${selected ? activeBorder : "var(--nelna-border)"}`,
        background: selected ? activeBg : "var(--nelna-surface)",
        color: "var(--nelna-text)",
        fontWeight: 600,
        fontFamily: "var(--nelna-font-sans)",
        fontSize: "1rem",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const fieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  fontFamily: "var(--nelna-font-sans)",
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "var(--nelna-text)",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: "72px",
  padding: "0.75rem",
  borderRadius: "10px",
  border: "2px solid var(--nelna-border)",
  fontFamily: "var(--nelna-font-sans)",
  fontSize: "1rem",
  resize: "vertical",
  boxSizing: "border-box",
};
