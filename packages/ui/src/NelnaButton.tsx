import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";

const variantStyles: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--nelna-primary)",
    color: "#fff",
    border: "2px solid var(--nelna-primary)",
  },
  secondary: {
    background: "var(--nelna-surface)",
    color: "var(--nelna-primary-dark)",
    border: "2px solid var(--nelna-border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--nelna-primary-dark)",
    border: "2px solid transparent",
  },
  danger: {
    background: "var(--nelna-danger)",
    color: "#fff",
    border: "2px solid var(--nelna-danger)",
  },
  gold: {
    background: "var(--nelna-gold)",
    color: "var(--nelna-dark)",
    border: "2px solid var(--nelna-gold)",
  },
};

export type NelnaButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
};

export function NelnaButton({
  variant = "primary",
  fullWidth = false,
  children,
  style,
  type = "button",
  disabled,
  ...rest
}: NelnaButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        minHeight: "var(--nelna-touch-min)",
        padding: "0.75rem 1.25rem",
        borderRadius: "var(--nelna-radius)",
        fontFamily: "var(--nelna-font-sans)",
        fontSize: "1rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        width: fullWidth ? "100%" : undefined,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
