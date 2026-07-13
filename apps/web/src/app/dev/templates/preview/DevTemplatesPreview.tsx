"use client";

import { useEffect, useState } from "react";
import type { ChecklistTemplateSummary, ChecklistTemplateVersionDefinition } from "@nelna/shared";
import { Alert, Button, EmptyState, LoadingState, PageHeader } from "@nelna/ui";
import { ChecklistTemplatePreview } from "@/components/ChecklistTemplatePreview";
import {
  ChecklistTemplateApiError,
  fetchPublishedTemplates,
  fetchPublishedVersion,
} from "@/lib/checklist-templates/api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; templates: ChecklistTemplateSummary[] };

/** Dev-only proof that NMS/PPU/CL/24 and NMS/PPU/CL/30 (and any future
 *  template) render entirely from API/seed data through the shared dynamic
 *  checklist engine — no page-specific rendering logic. */
export function DevTemplatesPreview() {
  const [templateState, setTemplateState] = useState<LoadState>({ status: "loading" });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [version, setVersion] = useState<ChecklistTemplateVersionDefinition | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublishedTemplates()
      .then((templates) => {
        setTemplateState({ status: "ready", templates });
        const first = templates.at(0);
        if (first) setSelectedCode(first.code);
      })
      .catch((error: unknown) => {
        const message = error instanceof ChecklistTemplateApiError ? error.message : "Failed to load templates.";
        setTemplateState({ status: "error", message });
      });
  }, []);

  useEffect(() => {
    if (!selectedCode) return;
    setVersion(null);
    setVersionError(null);
    fetchPublishedVersion(selectedCode)
      .then(setVersion)
      .catch((error: unknown) => {
        const message =
          error instanceof ChecklistTemplateApiError ? error.message : "Failed to load this template version.";
        setVersionError(message);
      });
  }, [selectedCode]);

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <PageHeader
        eyebrow="Developer preview"
        title="Checklist Template Preview"
        description="Renders a published checklist template version through the shared dynamic checklist engine (packages/ui + packages/shared) — the same components any future form will use."
      />

      {templateState.status === "loading" ? <LoadingState message="Loading published templates…" /> : null}

      {templateState.status === "error" ? (
        <Alert tone="danger" title="Could not load templates">
          {templateState.message}
        </Alert>
      ) : null}

      {templateState.status === "ready" && templateState.templates.length === 0 ? (
        <EmptyState
          title="No published templates yet"
          description="Publish a checklist template version to preview it here."
        />
      ) : null}

      {templateState.status === "ready" && templateState.templates.length > 0 ? (
        <div role="group" aria-label="Select a template" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {templateState.templates.map((template) => (
            <Button
              key={template.code}
              variant={template.code === selectedCode ? "primary" : "secondary"}
              onClick={() => setSelectedCode(template.code)}
            >
              {template.code} — {template.title}
            </Button>
          ))}
        </div>
      ) : null}

      {versionError ? (
        <Alert tone="danger" title="Could not load this version">
          {versionError}
        </Alert>
      ) : null}

      {!versionError && selectedCode && !version ? <LoadingState message="Loading template…" /> : null}

      {version ? <ChecklistTemplatePreview version={version} /> : null}
    </div>
  );
}
