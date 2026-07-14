import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@nelna/ui";

export const metadata: Metadata = {
  title: "Account inactive",
};

export default function AccountInactivePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4 py-10">
      <PageHeader
        eyebrow="Access"
        title="Account inactive"
        description="This account is inactive or suspended and cannot use the FG recording system."
      />
      <Card>
        <p className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          Contact your supervisor or System Administrator to restore access. Any drafts saved on this device were
          not marked as submitted.
        </p>
        <Link href="/login" className="mt-4 inline-block font-semibold text-nelna-primary">
          Back to sign in →
        </Link>
      </Card>
    </div>
  );
}
