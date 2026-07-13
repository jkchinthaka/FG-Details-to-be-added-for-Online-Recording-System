import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "information"
  | "gold";

export type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
};

/** Small status pill. Use `gold` sparingly — pending/highlight accents only. */
export function Badge({ tone = "neutral", children }: BadgeProps) {
  return <span className={`nelna-badge nelna-badge-${tone}`}>{children}</span>;
}
