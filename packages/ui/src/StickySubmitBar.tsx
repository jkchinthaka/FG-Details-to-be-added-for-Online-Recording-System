import type { ReactNode } from "react";

export type StickySubmitBarProps = {
  children: ReactNode;
  draftHint?: string;
};

/** Sticky bottom action bar for mobile-first record submission */
export function StickySubmitBar({ children, draftHint }: StickySubmitBarProps) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom))",
        background: "rgba(255, 255, 255, 0.96)",
        borderTop: "1px solid var(--nelna-border)",
        boxShadow: "0 -4px 16px rgba(37, 27, 37, 0.06)",
        zIndex: 40,
      }}
    >
      {draftHint ? (
        <p
          style={{
            margin: "0 0 0.5rem",
            fontSize: "0.85rem",
            color: "var(--nelna-text-muted)",
            fontFamily: "var(--nelna-font-sans)",
            textAlign: "center",
          }}
        >
          {draftHint}
        </p>
      ) : null}
      <div style={{ display: "grid", gap: "0.5rem" }}>{children}</div>
    </div>
  );
}
