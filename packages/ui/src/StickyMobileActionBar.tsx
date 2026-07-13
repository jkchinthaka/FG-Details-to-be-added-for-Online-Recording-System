import type { ReactNode } from "react";

export type StickyMobileActionBarProps = {
  children: ReactNode;
  hint?: string;
};

/**
 * Sticky bottom action bar for mobile-first primary actions (records,
 * wizards, task flows). Distinct from `StickySubmitBar`, which stays
 * dedicated to the Phase 1 cleaning / freezer truck record forms.
 */
export function StickyMobileActionBar({ children, hint }: StickyMobileActionBarProps) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom))",
        background: "rgba(255, 255, 255, 0.97)",
        borderTop: "1px solid var(--nelna-border)",
        boxShadow: "var(--nelna-shadow-sm)",
        zIndex: 40,
      }}
    >
      {hint ? (
        <p
          style={{
            margin: "0 0 0.5rem",
            fontSize: "0.85rem",
            color: "var(--nelna-text-secondary)",
            fontFamily: "var(--nelna-font-sans)",
            textAlign: "center",
          }}
        >
          {hint}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem" }}>{children}</div>
    </div>
  );
}
