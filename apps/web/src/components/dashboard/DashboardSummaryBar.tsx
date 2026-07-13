import type { DashboardSummary } from "@nelna/shared";
import { Card, ProgressIndicator, Skeleton } from "@nelna/ui";

export function DashboardSummaryBar({ summary }: { summary: DashboardSummary }) {
  return (
    <Card>
      <div className="grid grid-cols-3 gap-3 text-center">
        <SummaryStat label="Completed" value={summary.completed} color="var(--nelna-primary)" />
        <SummaryStat label="Pending" value={summary.pending} color="#7a5c00" />
        <SummaryStat label="Attention" value={summary.attentionRequired} color="var(--nelna-danger)" />
      </div>
      <div className="mt-4">
        <ProgressIndicator value={summary.completionPercent} label="Today's progress" />
      </div>
    </Card>
  );
}

export function DashboardSummaryBarSkeleton() {
  return (
    <Card>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton height="2.75rem" />
        <Skeleton height="2.75rem" />
        <Skeleton height="2.75rem" />
      </div>
      <div className="mt-4">
        <Skeleton height="0.6rem" rounded />
      </div>
    </Card>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-2xl font-bold" style={{ color, fontFamily: "var(--nelna-font-display)" }}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--nelna-text-secondary)" }}>
        {label}
      </p>
    </div>
  );
}
