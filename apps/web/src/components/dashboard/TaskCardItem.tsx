import Link from "next/link";
import { TASK_CARD_ACTION_LABELS, type TaskCard } from "@nelna/shared";
import { Card, TaskStatusBadge } from "@nelna/ui";

const actionAccent: Record<TaskCard["action"], string> = {
  START: "var(--nelna-primary)",
  CONTINUE: "#7a5c00",
  REVIEW: "var(--nelna-primary)",
  COMPLETED: "var(--nelna-text-muted)",
};

export function TaskCardItem({ task }: { task: TaskCard }) {
  return (
    <Link href={task.href} className="block" data-task-bucket={task.bucket}>
      <Card interactive>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {task.documentCode ? (
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-nelna-primary">
                {task.documentCode}
              </p>
            ) : null}
            <h3
              className="mt-1 text-base leading-snug text-nelna-primary-dark"
              style={{ fontFamily: "var(--nelna-font-display)" }}
            >
              {task.title}
            </h3>
          </div>
          <TaskStatusBadge status={task.status} />
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          {[task.areaLabel, task.shiftLabel].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--nelna-border)] pt-3">
          <span className="truncate text-xs" style={{ color: "var(--nelna-text-muted)" }}>
            {task.subtitle}
          </span>
          <span
            className="shrink-0 text-sm font-bold"
            style={{ color: actionAccent[task.action] }}
            data-testid="task-action"
          >
            {TASK_CARD_ACTION_LABELS[task.action]} →
          </span>
        </div>
      </Card>
    </Link>
  );
}
