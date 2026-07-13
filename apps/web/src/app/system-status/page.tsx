import type { Metadata } from "next";
import Link from "next/link";
import { SystemStatusPanel } from "@/components/SystemStatusPanel";

export const metadata: Metadata = {
  title: "System status",
};

export default function SystemStatusPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--nelna-text-muted)]">
        <Link href="/" className="font-semibold text-nelna-primary">
          ← Back to home
        </Link>
      </p>
      <SystemStatusPanel />
    </div>
  );
}
