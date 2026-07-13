import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonVariant = "ghost" | "solid";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
};

/** Icon-only control with a 48px minimum touch target and a mandatory accessible label. */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const classes = [
    "nelna-icon-btn",
    "nelna-focusable",
    variant === "solid" ? "nelna-icon-btn-solid" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} aria-label={label} title={label} className={classes} {...rest}>
      {icon}
    </button>
  );
}
