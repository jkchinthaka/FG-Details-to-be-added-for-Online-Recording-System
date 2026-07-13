import type { Metadata } from "next";
import Link from "next/link";
import { DOCUMENT_CODES } from "@nelna/shared";
import { Badge, Card, EmptyState, PageHeader } from "@nelna/ui";

export const metadata: Metadata = {
  title: "Records",
};

export default function RecordsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Finished Goods & QA"
        title="Records"
        description="Available Nelna FG record types. Submitted record history and search arrive with the database phase."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <RecordTypeCard
          href="/records/cleaning"
          code={DOCUMENT_CODES.DAILY_CLEANING}
          title="Daily Cleaning Verification"
          description="Finished Goods and Changing Room cleaning checks."
        />
        <RecordTypeCard
          href="/records/freezer-truck"
          code={DOCUMENT_CODES.FREEZER_TRUCK}
          title="Freezer Truck Inspection"
          description="Pre-loading checks and final loading decision."
        />
      </div>
      <EmptyState
        title="Record history is on the way"
        description="Submitted records, filters and search will appear here once the database and API phases land."
      />
    </div>
  );
}

function RecordTypeCard({
  href,
  code,
  title,
  description,
}: {
  href: string;
  code: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card interactive>
        <Badge tone="neutral">{code}</Badge>
        <h2
          className="mt-2 text-lg text-nelna-primary-dark"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          {title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          {description}
        </p>
      </Card>
    </Link>
  );
}
