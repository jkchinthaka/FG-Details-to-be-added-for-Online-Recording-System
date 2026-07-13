import type { TaskStatus } from "@nelna/shared";
import { TASK_STATUS_LABELS } from "@nelna/shared";

const statusStyles: Record<TaskStatus, { bg: string; color: string }> = {
  ASSIGNED: { bg: "var(--nelna-cream)", color: "var(--nelna-primary-dark)" },
  IN_PROGRESS: { bg: "#fff6d6", color: "#7a5c00" },
  SUBMITTED: { bg: "var(--nelna-success-bg)", color: "var(--nelna-primary)" },
  VERIFIED: { bg: "var(--nelna-primary)", color: "#fff" },
  REJECTED: { bg: "var(--nelna-danger-bg)", color: "var(--nelna-danger)" },
};

export type TaskStatusBadgeProps = {
  status: TaskStatus;
};

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const tone = statusStyles[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "1.75rem",
        padding: "0.2rem 0.65rem",
        borderRadius: "999px",
        background: tone.bg,
        color: tone.color,
        fontFamily: "var(--nelna-font-sans)",
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
