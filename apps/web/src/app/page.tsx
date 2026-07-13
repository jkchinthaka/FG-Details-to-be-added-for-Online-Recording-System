import Link from "next/link";
import { RECORD_TYPE_META } from "@nelna/shared";
import { EmptyState, TaskStatusBadge } from "@nelna/ui";
import { formatTaskSubtitle, getTodaysTasks } from "@/lib/todays-tasks";

export default function TodayPage() {
  const tasks = getTodaysTasks();
  const nowLabel = new Date().toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-5">
      <section
        className="rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white/90 p-4"
        aria-labelledby="today-heading"
      >
        <p className="text-sm text-[var(--nelna-text-muted)]">{nowLabel}</p>
        <h2
          id="today-heading"
          className="mt-1 text-2xl text-nelna-primary-dark"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Today&apos;s tasks
        </h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--nelna-text-muted)]">
          Open a task, tap Mark All Acceptable, change only failed items, then
          submit. Date, time and shift are captured automatically.
        </p>
      </section>

      {tasks.length === 0 ? (
        <EmptyState
          title="No FG tasks assigned"
          description="When your supervisor assigns cleaning or freezer truck checks, they will appear here for this shift."
        />
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => {
            const meta = RECORD_TYPE_META[task.recordType];
            return (
              <li key={task.id}>
                <Link
                  href={task.href}
                  className="block rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white p-4 transition-colors hover:border-nelna-primary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-nelna-primary">
                        {meta.shortLabel}
                      </p>
                      <h3
                        className="mt-1 text-lg leading-snug text-nelna-primary-dark"
                        style={{ fontFamily: "var(--nelna-font-display)" }}
                      >
                        {meta.title}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--nelna-text-muted)]">
                        {formatTaskSubtitle(task)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-nelna-primary-dark">
                        {task.areaLabel}
                      </p>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-nelna-primary">
                    Open record →
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
