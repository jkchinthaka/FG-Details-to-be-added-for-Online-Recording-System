"use client";

import { useState } from "react";
import type {
  ChecklistResponseMap,
  ChecklistTemplateVersionDefinition,
} from "@nelna/shared";
import { Badge, Card, Checkbox, ChecklistRenderer, type BadgeTone } from "@nelna/ui";

type Viewport = "mobile" | "tablet" | "desktop";

const DEFAULT_VIEWPORT = { id: "desktop" as const, label: "Desktop", width: "100%" };

const VIEWPORTS: Array<{ id: Viewport; label: string; width: string }> = [
  { id: "mobile", label: "Mobile", width: "min(100%, 390px)" },
  { id: "tablet", label: "Tablet", width: "min(100%, 768px)" },
  DEFAULT_VIEWPORT,
];

const STATUS_TONE: Record<ChecklistTemplateVersionDefinition["status"], BadgeTone> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export type ChecklistTemplatePreviewProps = {
  version: ChecklistTemplateVersionDefinition;
};

/**
 * Renders one template version through the exact same `ChecklistRenderer`
 * the real record pages will use, at mobile/tablet/desktop widths — proof
 * that the dynamic engine (not page-specific code) drives the checklist UI.
 * Responses here are local/in-memory only; nothing is submitted.
 */
export function ChecklistTemplatePreview({ version }: ChecklistTemplatePreviewProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [responses, setResponses] = useState<ChecklistResponseMap>({});
  const [showValidationSummary, setShowValidationSummary] = useState(false);

  const activeViewport =
    VIEWPORTS.find((entry) => entry.id === viewport) ?? DEFAULT_VIEWPORT;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <Card>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <Badge tone={STATUS_TONE[version.status]}>
                {version.status} · v{version.versionNumber}
              </Badge>
              <span style={{ fontSize: "0.8rem", color: "var(--nelna-text-muted)" }}>
                {version.code}
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--nelna-font-display)",
                fontSize: "1.3rem",
                color: "var(--nelna-primary-active)",
              }}
            >
              {version.title}
            </h2>
            {version.description ? (
              <p
                style={{
                  margin: 0,
                  color: "var(--nelna-text-secondary)",
                  maxWidth: "60ch",
                }}
              >
                {version.description}
              </p>
            ) : null}
          </div>

          <div
            role="group"
            aria-label="Preview viewport"
            style={{ display: "flex", gap: "0.4rem" }}
          >
            {VIEWPORTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={viewport === entry.id}
                onClick={() => setViewport(entry.id)}
                className={[
                  "nelna-segmented-option",
                  "nelna-focusable",
                  viewport === entry.id ? "nelna-tone-primary" : "nelna-tone-neutral",
                ].join(" ")}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "0.85rem" }}>
          <Checkbox
            label="Show validation summary (simulate a submit attempt)"
            checked={showValidationSummary}
            onChange={(e) => setShowValidationSummary(e.target.checked)}
          />
        </div>
      </Card>

      <div
        style={{
          marginInline: "auto",
          width: "100%",
          maxWidth: activeViewport.width,
          transition: "max-width 0.2s ease",
        }}
      >
        <ChecklistRenderer
          version={version}
          responses={responses}
          onResponsesChange={setResponses}
          showValidationSummary={showValidationSummary}
        />
      </div>
    </div>
  );
}
