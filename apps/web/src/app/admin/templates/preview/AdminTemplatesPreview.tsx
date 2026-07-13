"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChecklistTemplateSummary, ChecklistTemplateVersionDefinition } from "@nelna/shared";
import { Alert, Button, EmptyState, LoadingState, PageHeader, Select } from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";
import { ChecklistTemplatePreview } from "@/components/ChecklistTemplatePreview";
import {
  ChecklistTemplateApiError,
  fetchAllTemplates,
  fetchTemplateSummary,
  fetchTemplateVersion,
} from "@/lib/checklist-templates/api";

type TemplatesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; templates: ChecklistTemplateSummary[] };

function latestVersionNumber(summary: ChecklistTemplateSummary): number | null {
  if (summary.versions.length === 0) return null;
  return Math.max(...summary.versions.map((version) => version.versionNumber));
}

/**
 * Admin checklist template preview — lets a template manager/publisher
 * inspect any version (draft or published) of NMS/PPU/CL/24, NMS/PPU/CL/30
 * or any future template through the shared dynamic renderer before
 * publishing. Gated behind the `templates:manage` / `templates:publish`
 * permissions (the same ones the API enforces on the underlying routes).
 */
export function AdminTemplatesPreview() {
  const { status: authStatus, user } = useAuth();
  const canManageTemplates = Boolean(
    user?.permissions.includes("templates:manage") || user?.permissions.includes("templates:publish"),
  );

  const [templatesState, setTemplatesState] = useState<TemplatesState>({ status: "loading" });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<ChecklistTemplateSummary | null>(null);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const [version, setVersion] = useState<ChecklistTemplateVersionDefinition | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated" || !canManageTemplates) return;
    fetchAllTemplates()
      .then((templates) => {
        setTemplatesState({ status: "ready", templates });
        const first = templates.at(0);
        if (first) setSelectedCode(first.code);
      })
      .catch((error: unknown) => {
        const message = error instanceof ChecklistTemplateApiError ? error.message : "Failed to load templates.";
        setTemplatesState({ status: "error", message });
      });
  }, [authStatus, canManageTemplates]);

  useEffect(() => {
    if (!selectedCode) return;
    setSummary(null);
    setVersionError(null);
    fetchTemplateSummary(selectedCode)
      .then((nextSummary) => {
        setSummary(nextSummary);
        setSelectedVersionNumber(latestVersionNumber(nextSummary));
      })
      .catch((error: unknown) => {
        const message = error instanceof ChecklistTemplateApiError ? error.message : "Failed to load this template.";
        setVersionError(message);
      });
  }, [selectedCode]);

  useEffect(() => {
    if (!selectedCode || selectedVersionNumber === null) {
      setVersion(null);
      return;
    }
    setVersion(null);
    fetchTemplateVersion(selectedCode, selectedVersionNumber)
      .then(setVersion)
      .catch((error: unknown) => {
        const message =
          error instanceof ChecklistTemplateApiError ? error.message : "Failed to load this version.";
        setVersionError(message);
      });
  }, [selectedCode, selectedVersionNumber]);

  const versionOptions = useMemo(
    () =>
      (summary?.versions ?? [])
        .slice()
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .map((v) => ({
          value: String(v.versionNumber),
          label: `v${v.versionNumber} — ${v.status}`,
        })),
    [summary],
  );

  if (authStatus === "loading") {
    return <LoadingState message="Checking your session…" />;
  }

  if (!canManageTemplates) {
    return (
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <PageHeader eyebrow="Administration" title="Checklist Templates — Preview" />
        <Alert tone="danger" title="Not authorized">
          Previewing checklist templates requires the &quot;templates:manage&quot; or &quot;templates:publish&quot;
          permission.
        </Alert>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <PageHeader
        eyebrow="Administration"
        title="Checklist Templates — Preview"
        description="Inspect any draft or published version of a checklist template through the shared dynamic renderer before publishing."
      />

      {templatesState.status === "loading" ? <LoadingState message="Loading templates…" /> : null}

      {templatesState.status === "error" ? (
        <Alert tone="danger" title="Could not load templates">
          {templatesState.message}
        </Alert>
      ) : null}

      {templatesState.status === "ready" && templatesState.templates.length === 0 ? (
        <EmptyState title="No templates yet" description="Create a checklist template to preview it here." />
      ) : null}

      {templatesState.status === "ready" && templatesState.templates.length > 0 ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div role="group" aria-label="Select a template" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {templatesState.templates.map((template) => (
              <Button
                key={template.code}
                variant={template.code === selectedCode ? "primary" : "secondary"}
                onClick={() => setSelectedCode(template.code)}
              >
                {template.code}
              </Button>
            ))}
          </div>

          {versionOptions.length > 0 ? (
            <div style={{ minWidth: "200px" }}>
              <Select
                label="Version"
                options={versionOptions}
                value={selectedVersionNumber !== null ? String(selectedVersionNumber) : ""}
                onChange={(e) => setSelectedVersionNumber(Number(e.target.value))}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {versionError ? (
        <Alert tone="danger" title="Could not load this version">
          {versionError}
        </Alert>
      ) : null}

      {!versionError && selectedCode && summary && summary.versions.length === 0 ? (
        <EmptyState
          title="No versions yet"
          description={`"${selectedCode}" has no draft or published versions to preview.`}
        />
      ) : null}

      {!versionError && selectedCode && !version && summary && summary.versions.length > 0 ? (
        <LoadingState message="Loading version…" />
      ) : null}

      {version ? <ChecklistTemplatePreview version={version} /> : null}
    </div>
  );
}
