import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "gold";
export type ButtonSize = "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
};

/** Primary interactive control. 48px touch target by default; use size="lg" for hero CTAs. */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const classes = [
    "nelna-btn",
    "nelna-focusable",
    `nelna-btn-${variant}`,
    `nelna-btn-${size}`,
    fullWidth ? "nelna-btn-full" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {loading ? <ButtonSpinner /> : leftIcon}
      <span>{children}</span>
      {!loading ? rightIcon : null}
    </button>
  );
}

function ButtonSpinner() {
  const style: CSSProperties = {
    width: "1rem",
    height: "1rem",
    borderRadius: "50%",
    border: "2px solid currentColor",
    borderTopColor: "transparent",
    display: "inline-block",
    animation: "nelna-spin 0.7s linear infinite",
  };
  return <span aria-hidden style={style} />;
}
