import type { ReactNode } from "react";

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "2.5rem 1.25rem",
        background: "var(--nelna-surface-muted)",
        borderRadius: "var(--nelna-radius)",
        border: "1px dashed var(--nelna-border)",
      }}
    >
      <h2
        style={{
          margin: "0 0 0.5rem",
          fontFamily: "var(--nelna-font-display)",
          fontSize: "1.35rem",
          color: "var(--nelna-primary-dark)",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: "0 0 1.25rem",
          fontFamily: "var(--nelna-font-sans)",
          color: "var(--nelna-text-muted)",
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      {action}
    </div>
  );
}
