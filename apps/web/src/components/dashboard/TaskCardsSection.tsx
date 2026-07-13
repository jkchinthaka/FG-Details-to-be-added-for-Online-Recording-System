import type { TaskCard, TaskCardBucket } from "@nelna/shared";
import { Badge, Card, EmptyState, Skeleton } from "@nelna/ui";
import { toneForTaskCardBucket } from "@/lib/dashboard/format";
import { TaskCardItem } from "./TaskCardItem";

const GROUP_ORDER: { bucket: TaskCardBucket; heading: string }[] = [
  { bucket: "attention", heading: "Needs attention" },
  { bucket: "pending", heading: "Pending" },
  { bucket: "completed", heading: "Completed" },
];

/** Groups today's task/queue cards by bucket so the most urgent work (rejections,
 *  pending checks) always renders above completed items — never a bare unordered list. */
export function TaskCardsSection({ tasks }: { tasks: TaskCard[] }) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks for today"
        description="Once records are assigned to you — or reach your queue — they'll appear here."
      />
    );
  }

  return (
    <div className="space-y-5">
      {GROUP_ORDER.map(({ bucket, heading }) => {
        const group = tasks.filter((task) => task.bucket === bucket);
        if (group.length === 0) return null;
        return (
          <div key={bucket}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-bold text-nelna-primary-dark">{heading}</h2>
              <Badge tone={toneForTaskCardBucket(bucket)}>{group.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.map((task) => (
                <TaskCardItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TaskCardsSectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[0, 1, 2].map((key) => (
        <Card key={key}>
          <Skeleton height="1rem" width="60%" />
          <Skeleton height="1.25rem" width="85%" className="mt-2" />
          <Skeleton height="0.9rem" width="70%" className="mt-3" />
        </Card>
      ))}
    </div>
  );
}
