import type { Metadata } from "next";
import Link from "next/link";
import { RECORD_TYPE_META } from "@nelna/shared";
import { Card, PageHeader, TaskStatusBadge } from "@nelna/ui";
import { formatTaskSubtitle, getTodaysTasks } from "@/lib/todays-tasks";

export const metadata: Metadata = {
  title: "My Tasks",
};

export default function TasksPage() {
  const tasks = getTodaysTasks();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Assigned to you"
        title="My Tasks"
        description="Records assigned for your current shift. Mark All Acceptable keeps the happy path to a couple of taps."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {tasks.map((task) => (
          <Link key={task.id} href={task.href}>
            <Card interactive>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-nelna-primary">
                    {RECORD_TYPE_META[task.recordType].documentCode}
                  </p>
                  <h2
                    className="mt-1 text-lg text-nelna-primary-dark"
                    style={{ fontFamily: "var(--nelna-font-display)" }}
                  >
                    {RECORD_TYPE_META[task.recordType].title}
                  </h2>
                </div>
                <TaskStatusBadge status={task.status} />
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
                {task.areaLabel} · {formatTaskSubtitle(task)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
