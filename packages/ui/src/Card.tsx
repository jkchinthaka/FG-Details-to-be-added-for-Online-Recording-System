import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: "md" | "lg";
  muted?: boolean;
  interactive?: boolean;
  children: ReactNode;
};

/** White operational card — the default surface for grouped content. */
export function Card({
  padding = "md",
  muted = false,
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [
    "nelna-card",
    padding === "lg" ? "nelna-card-padded-lg" : null,
    muted ? "nelna-card-muted" : null,
    interactive ? "nelna-card-interactive" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
