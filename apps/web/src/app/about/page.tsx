import type { Metadata } from "next";
import { NELNA_BRAND } from "@nelna/shared";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <article className="space-y-4 rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white/90 p-5">
      <h2
        className="text-2xl text-nelna-primary-dark"
        style={{ fontFamily: "var(--nelna-font-display)" }}
      >
        {NELNA_BRAND.productName}
      </h2>
      <p className="leading-relaxed text-[var(--nelna-text-muted)]">
        Built for Nelna Farm Finished Goods and Quality Assurance teams to
        replace paper checklists with a low-click, exception-based digital
        recording workflow on phone and tablet.
      </p>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-[var(--nelna-text-muted)]">Developer</dt>
          <dd className="font-semibold text-nelna-primary-dark">
            {NELNA_BRAND.developer}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--nelna-text-muted)]">Reference documents</dt>
          <dd className="font-semibold text-nelna-primary-dark">
            NMS/PPU/CL/24 · NMS/PPU/CL/30
          </dd>
        </div>
      </dl>
    </article>
  );
}
