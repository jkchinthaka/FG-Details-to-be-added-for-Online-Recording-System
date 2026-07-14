import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@nelna/ui";

export const metadata: Metadata = {
  title: "Unauthorized",
};

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4 py-10">
      <PageHeader
        eyebrow="Access"
        title="Unauthorized"
        description="You are signed in, but your role does not allow this page."
      />
      <Card>
        <p className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          If you need access, ask a System Administrator to review your roles. Local draft data on this device was
          not submitted.
        </p>
        <Link href="/tasks" className="mt-4 inline-block font-semibold text-nelna-primary">
          Return to Today&apos;s Tasks →
        </Link>
      </Card>
    </div>
  );
}
