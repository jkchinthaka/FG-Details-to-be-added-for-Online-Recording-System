"use client";

import Link from "next/link";
import type { RecentRecordSummary } from "@nelna/shared";
import { RECORD_STATUS_LABELS } from "@nelna/shared";
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from "@nelna/ui";
import { useRecentRecords } from "@/lib/dashboard/useRecentRecords";

const STATUS_TONE: Record<RecentRecordSummary["status"], "neutral" | "success" | "warning" | "danger" | "information"> = {
  DRAFT: "neutral",
  SUBMITTED: "information",
  CHECKED: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
  ARCHIVED: "neutral",
};

/** Compact "last few submitted/completed" list — intentionally not a full
 *  paginated table on mobile (see docs/records.md). Independent loading/error
 *  state from the rest of the dashboard, per prompt requirements. */
export function RecentRecordsSection() {
  const resource = useRecentRecords();

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-nelna-primary">Recent records</h2>
        <Link href="/records" className="text-sm font-semibold text-nelna-primary">
          View all
        </Link>
      </div>

      <div className="mt-3">
        {resource.status === "loading" ? <RecentRecordsSkeleton /> : null}

        {resource.status === "error" ? (
          <Alert tone="danger" title="Couldn't load recent records">
            <p>{resource.error}</p>
            <Button variant="secondary" size="md" className="mt-3" onClick={resource.retry}>
              Retry
            </Button>
          </Alert>
        ) : null}

        {resource.status === "success" && resource.data.records.length === 0 ? (
          <EmptyState title="No records yet" description="Records you submit or complete will show up here." />
        ) : null}

        {resource.status === "success" && resource.data.records.length > 0 ? (
          <ul className="space-y-2">
            {resource.data.records.map((record) => (
              <RecentRecordRow key={record.id} record={record} />
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

function RecentRecordRow({ record }: { record: RecentRecordSummary }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-[var(--nelna-radius-sm)] border border-[var(--nelna-border)] px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-nelna-primary-dark">{record.title}</p>
        <p className="truncate text-xs" style={{ color: "var(--nelna-text-muted)" }}>
          {[record.documentCode, record.areaLabel].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Badge tone={STATUS_TONE[record.status]}>{RECORD_STATUS_LABELS[record.status]}</Badge>
    </li>
  );
}

function RecentRecordsSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} height="3rem" />
      ))}
    </div>
  );
}
