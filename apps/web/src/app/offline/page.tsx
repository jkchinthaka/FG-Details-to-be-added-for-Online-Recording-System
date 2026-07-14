import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline",
};

/** Cached fallback page used by the service worker when navigations fail offline. */
export default function OfflineFallbackPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-4 py-10">
      <h1 className="text-2xl font-bold text-nelna-primary-dark" style={{ fontFamily: "var(--nelna-font-display)" }}>
        You are offline
      </h1>
      <p className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
        Nelna FG keeps local drafts on this device. Work is not marked submitted until the server confirms sync.
      </p>
      <Link href="/tasks" className="font-semibold text-nelna-primary">
        Try Today&apos;s Tasks again →
      </Link>
    </main>
  );
}
