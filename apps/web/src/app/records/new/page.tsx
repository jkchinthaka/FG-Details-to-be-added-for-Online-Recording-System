import type { Metadata } from "next";
import Link from "next/link";
import { DOCUMENT_CODES } from "@nelna/shared";
import { Badge, Card, PageHeader } from "@nelna/ui";

export const metadata: Metadata = {
  title: "New Record",
};

export default function NewRecordPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Start a record"
        title="New Record"
        description="Choose a record type to begin. Task-linked creation and custom templates arrive in later phases."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/records/cleaning">
          <Card interactive>
            <Badge tone="neutral">{DOCUMENT_CODES.DAILY_CLEANING}</Badge>
            <h2
              className="text-nelna-primary-dark mt-2 text-lg"
              style={{ fontFamily: "var(--nelna-font-display)" }}
            >
              Daily Cleaning Verification
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
              Finished Goods and Changing Room cleaning checks.
            </p>
          </Card>
        </Link>
        <Link href="/records/freezer-truck">
          <Card interactive>
            <Badge tone="neutral">{DOCUMENT_CODES.FREEZER_TRUCK}</Badge>
            <h2
              className="text-nelna-primary-dark mt-2 text-lg"
              style={{ fontFamily: "var(--nelna-font-display)" }}
            >
              Freezer Truck Inspection
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
              Pre-loading checks and final loading decision.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
