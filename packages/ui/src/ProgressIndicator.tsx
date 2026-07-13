export type ProgressIndicatorProps = {
  /** 0–100 */
  value: number;
  label?: string;
};

/** Linear progress bar, e.g. checklist completion within a record. */
export function ProgressIndicator({ value, label }: ProgressIndicatorProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div style={{ display: "grid", gap: "0.4rem", fontFamily: "var(--nelna-font-sans)" }}>
      {label ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.85rem",
            color: "var(--nelna-text-secondary)",
          }}
        >
          <span>{label}</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="nelna-progress-track"
      >
        <div className="nelna-progress-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
