import { NelnaButton } from "./NelnaButton";

export type MarkAllAcceptableBarProps = {
  onMarkAll: () => void;
  disabled?: boolean;
  itemCount: number;
};

/** One-tap happy path for exception-based FG / QA recording */
export function MarkAllAcceptableBar({
  onMarkAll,
  disabled,
  itemCount,
}: MarkAllAcceptableBarProps) {
  return (
    <div
      style={{
        padding: "1rem",
        background: "var(--nelna-surface-muted)",
        border: "1px solid var(--nelna-border)",
        borderRadius: "var(--nelna-radius)",
        display: "grid",
        gap: "0.5rem",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "var(--nelna-font-sans)",
          color: "var(--nelna-text-muted)",
          fontSize: "0.95rem",
        }}
      >
        All checks look good? Mark all {itemCount} items acceptable, then only
        change failed items.
      </p>
      <NelnaButton
        variant="primary"
        fullWidth
        onClick={onMarkAll}
        disabled={disabled}
        aria-label={`Mark all ${itemCount} items acceptable`}
      >
        Mark All Acceptable
      </NelnaButton>
    </div>
  );
}
