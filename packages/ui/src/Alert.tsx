import type { ReactNode } from "react";

export type AlertTone = "success" | "warning" | "danger" | "information";

export type AlertProps = {
  tone?: AlertTone;
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
};

const roleByTone: Record<AlertTone, "status" | "alert"> = {
  success: "status",
  information: "status",
  warning: "alert",
  danger: "alert",
};

/** Inline banner for validation summaries and record-level notices. */
export function Alert({ tone = "information", title, icon, children }: AlertProps) {
  return (
    <div className={`nelna-alert nelna-alert-${tone}`} role={roleByTone[tone]}>
      {icon}
      <div>
        {title ? <p style={{ margin: 0, fontWeight: 700 }}>{title}</p> : null}
        <div style={{ marginTop: title ? "0.25rem" : 0 }}>{children}</div>
      </div>
    </div>
  );
}
