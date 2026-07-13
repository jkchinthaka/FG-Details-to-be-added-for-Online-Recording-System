export type LoadingStateProps = {
  message?: string;
};

/** Full-block loading indicator for a page or section still fetching data. */
export function LoadingState({ message = "Loading…" }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "grid",
        justifyItems: "center",
        gap: "0.75rem",
        padding: "2.5rem 1.25rem",
        color: "var(--nelna-text-secondary)",
        fontFamily: "var(--nelna-font-sans)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: "2rem",
          height: "2rem",
          borderRadius: "50%",
          border: "3px solid var(--nelna-border)",
          borderTopColor: "var(--nelna-primary)",
          animation: "nelna-spin 0.8s linear infinite",
        }}
      />
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}
