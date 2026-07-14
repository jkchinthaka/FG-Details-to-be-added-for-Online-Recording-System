import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
};

/** Consistent page-level heading: eyebrow label, display title, description, actions. */
export function PageHeader({ title, eyebrow, description, actions }: PageHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <div style={{ display: "grid", gap: "0.35rem" }}>
        {eyebrow ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--nelna-primary)",
            }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--nelna-font-display)",
            fontSize: "1.6rem",
            lineHeight: 1.2,
            color: "var(--nelna-primary-active)",
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            style={{ margin: 0, color: "var(--nelna-text-secondary)", maxWidth: "60ch" }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{actions}</div>
      ) : null}
    </header>
  );
}
