import Link from "next/link";
import { NELNA_BRAND } from "@nelna/shared";
import { SystemStatusPanel } from "@/components/SystemStatusPanel";

export default function HomePage() {
  return (
    <div className="space-y-5">
      <section className="rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white/95 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-nelna-primary">
          Foundation online
        </p>
        <h2
          className="mt-2 text-[1.75rem] leading-tight text-nelna-primary-dark sm:text-3xl"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          {NELNA_BRAND.productName}
        </h2>
        <p className="mt-3 max-w-prose text-[0.98rem] leading-relaxed text-[var(--nelna-text-muted)]">
          The monorepo is running. Use this home screen to confirm the web app
          is live, then check API health below. Operational recording workflows
          land in later phases.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link
            href="/system-status"
            className="flex min-h-12 items-center justify-center rounded-[var(--nelna-radius)] bg-nelna-primary px-4 text-center text-sm font-semibold text-white"
          >
            Open system status
          </Link>
          <Link
            href="/records/cleaning"
            className="flex min-h-12 items-center justify-center rounded-[var(--nelna-radius)] border-2 border-[var(--nelna-border)] px-4 text-center text-sm font-semibold text-nelna-primary-dark"
          >
            Preview cleaning form
          </Link>
        </div>
      </section>

      <SystemStatusPanel />

      <section className="rounded-[var(--nelna-radius)] border border-dashed border-[var(--nelna-border)] bg-[var(--nelna-surface-muted)] p-4 text-sm text-[var(--nelna-text-muted)]">
        <p>
          Stack: Next.js web · NestJS API · PostgreSQL/Prisma · shared Nelna
          packages.
        </p>
        <p className="mt-2">
          Docs:{" "}
          <span className="font-medium text-nelna-primary-dark">
            docs/PROJECT_BRIEF.md
          </span>
          ,{" "}
          <span className="font-medium text-nelna-primary-dark">
            docs/ARCHITECTURE.md
          </span>
          .
        </p>
      </section>
    </div>
  );
}
