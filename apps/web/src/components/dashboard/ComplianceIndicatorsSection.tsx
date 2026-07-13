import type { ComplianceIndicator } from "@nelna/shared";
import { Badge, Card } from "@nelna/ui";

/** Compact Food-Safety-Team-Leader widget: label + single value per indicator,
 *  deliberately not a chart (see docs/PROJECT_BRIEF.md UX guardrails). */
export function ComplianceIndicatorsSection({ indicators }: { indicators: ComplianceIndicator[] }) {
  if (indicators.length === 0) return null;

  return (
    <Card>
      <h2 className="text-sm font-bold uppercase tracking-wide text-nelna-primary">Compliance snapshot</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {indicators.map((indicator) => (
          <div
            key={indicator.id}
            className="flex items-center justify-between gap-2 rounded-[var(--nelna-radius-sm)] border border-[var(--nelna-border)] px-3 py-2.5"
          >
            <span className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
              {indicator.label}
            </span>
            <Badge tone={indicator.tone}>{indicator.value}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
