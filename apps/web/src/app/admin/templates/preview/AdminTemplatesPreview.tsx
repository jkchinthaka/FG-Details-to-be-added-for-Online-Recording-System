"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ChecklistResponseMap,
  ChecklistTemplateSummary,
  ChecklistTemplateVersionDefinition,
} from "@nelna/shared";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ChecklistRenderer,
  ConfirmationDialog,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Skeleton,
  type BadgeTone,
} from "@nelna/ui";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
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

type StatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
type Viewport = "mobile" | "tablet" | "desktop";

const STATUS_TONE: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", BadgeTone> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

const VIEWPORTS: Array<{ id: Viewport; label: string; maxWidth: string }> = [
  { id: "mobile", label: "Mobile", maxWidth: "min(100%, 390px)" },
  { id: "tablet", label: "Tablet", maxWidth: "min(100%, 768px)" },
  { id: "desktop", label: "Desktop", maxWidth: "100%" },
];

function latestVersionNumber(summary: ChecklistTemplateSummary): number | null {
  if (summary.versions.length === 0) return null;
  return Math.max(...summary.versions.map((version) => version.versionNumber));
}

function countItems(version: ChecklistTemplateVersionDefinition) {
  const items = version.sections.flatMap((section) => section.items);
  return {
    sectionCount: version.sections.length,
    itemCount: items.length,
    requiredCount: items.filter((item) => item.isRequired).length,
  };
}

/**
 * Admin checklist template preview — inspect draft/published versions through
 * the shared dynamic renderer. Responses are local only (preview mode).
 */
export function AdminTemplatesPreview() {
  const { status: authStatus, user } = useAuth();
  const canManageTemplates = Boolean(
    user?.permissions.includes("templates:manage") ||
      user?.permissions.includes("templates:publish"),
  );
  const canPublish = Boolean(user?.permissions.includes("templates:publish"));
  const announceId = useId();

  const [templatesState, setTemplatesState] = useState<TemplatesState>({
    status: "loading",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<ChecklistTemplateSummary | null>(null);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const [version, setVersion] = useState<ChecklistTemplateVersionDefinition | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [responses, setResponses] = useState<ChecklistResponseMap>({});
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const summarySeq = useRef(0);
  const versionSeq = useRef(0);

  useEffect(() => {
    if (authStatus !== "authenticated" || !canManageTemplates) return;
    const controller = new AbortController();
    setTemplatesState({ status: "loading" });
    fetchAllTemplates()
      .then((templates) => {
        if (controller.signal.aborted) return;
        setTemplatesState({ status: "ready", templates });
        const first = templates.at(0);
        if (first) setSelectedCode(first.code);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof ChecklistTemplateApiError
            ? error.message
            : "We could not load templates. Check your connection and try again.";
        setTemplatesState({ status: "error", message });
      });
    return () => controller.abort();
  }, [authStatus, canManageTemplates]);

  useEffect(() => {
    if (!selectedCode) return;
    const seq = ++summarySeq.current;
    setSummary(null);
    setVersion(null);
    setVersionError(null);
    setResponses({});
    setDirty(false);
    setShowValidationSummary(false);

    fetchTemplateSummary(selectedCode)
      .then((nextSummary) => {
        if (seq !== summarySeq.current) return;
        setSummary(nextSummary);
        setSelectedVersionNumber(latestVersionNumber(nextSummary));
        setAnnounce(`Template ${selectedCode} loaded.`);
        previewHeadingRef.current?.focus();
      })
      .catch((error: unknown) => {
        if (seq !== summarySeq.current) return;
        const message =
          error instanceof ChecklistTemplateApiError
            ? error.message
            : "We could not load this template. Try again.";
        setVersionError(message);
      });
  }, [selectedCode]);

  useEffect(() => {
    if (!selectedCode || selectedVersionNumber === null) {
      setVersion(null);
      return;
    }
    const seq = ++versionSeq.current;
    setVersion(null);
    setVersionError(null);
    setVersionLoading(true);
    setResponses({});
    setDirty(false);

    fetchTemplateVersion(selectedCode, selectedVersionNumber)
      .then((next) => {
        if (seq !== versionSeq.current) return;
        setVersion(next);
        setAnnounce(`Version ${selectedVersionNumber} ready for preview.`);
        previewHeadingRef.current?.focus();
      })
      .catch((error: unknown) => {
        if (seq !== versionSeq.current) return;
        const message =
          error instanceof ChecklistTemplateApiError
            ? error.message
            : "We could not load this version. Try again.";
        setVersionError(message);
      })
      .finally(() => {
        if (seq === versionSeq.current) setVersionLoading(false);
      });
  }, [selectedCode, selectedVersionNumber]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const filteredTemplates = useMemo(() => {
    if (templatesState.status !== "ready") return [];
    const q = search.trim().toLowerCase();
    return templatesState.templates.filter((template) => {
      const status = template.currentVersion?.status;
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (!q) return true;
      return (
        template.code.toLowerCase().includes(q) ||
        template.title.toLowerCase().includes(q)
      );
    });
  }, [templatesState, search, statusFilter]);

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

  const activeViewport =
    VIEWPORTS.find((entry) => entry.id === viewport) ?? VIEWPORTS[2]!;
  const counts = version ? countItems(version) : null;

  function requestNavigate(href: string) {
    if (dirty) {
      setPendingHref(href);
      setLeaveOpen(true);
      return;
    }
    window.location.assign(href);
  }

  function resetResponses() {
    setResponses({});
    setDirty(false);
    setShowValidationSummary(false);
    setResetOpen(false);
    setAnnounce("Preview responses cleared.");
  }

  if (authStatus === "loading") {
    return <LoadingState message="Checking your session…" />;
  }

  if (!canManageTemplates) {
    return (
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <PageHeader eyebrow="Administration" title="Checklist Templates — Preview" />
        <Alert tone="danger" title="Not authorized">
          Previewing checklist templates requires the &quot;templates:manage&quot; or
          &quot;templates:publish&quot; permission.
        </Alert>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div aria-live="polite" className="nelna-sr-only" id={announceId}>
        {announce}
      </div>

      <Alert tone="warning" title="Preview mode — responses entered here are not saved.">
        Use this screen to inspect layout and validation only. Nothing is written to
        production records.
      </Alert>

      <PageHeader
        eyebrow="Administration"
        title="Checklist Templates — Preview"
        description="Inspect any draft or published version through the shared dynamic renderer before publishing."
      />

      <div
        className="sticky top-16 z-20 rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white p-3"
        style={{ boxShadow: "var(--nelna-shadow-sm)" }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <Button type="button" variant="secondary" onClick={() => requestNavigate("/admin")}>
            Back to templates
          </Button>
          {selectedCode ? (
            <Button type="button" variant="secondary" onClick={() => requestNavigate("/admin")}>
              Edit
            </Button>
          ) : null}
          {canPublish && version?.status === "DRAFT" ? (
            <Button type="button" variant="gold" disabled title="Publish from the templates admin list">
              Publish
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty}
            onClick={() => setResetOpen(true)}
          >
            Reset responses
          </Button>
          <div
            role="group"
            aria-label="Preview viewport size"
            style={{ display: "flex", gap: "0.35rem", marginLeft: "auto" }}
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
                style={{ minHeight: "var(--nelna-touch-comfortable)" }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {templatesState.status === "loading" ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <Skeleton height="2.5rem" />
          <Skeleton height="8rem" />
        </div>
      ) : null}

      {templatesState.status === "error" ? (
        <Alert tone="danger" title="Could not load templates">
          <p>{templatesState.message}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setTemplatesState({ status: "loading" });
              fetchAllTemplates()
                .then((templates) => {
                  setTemplatesState({ status: "ready", templates });
                  const first = templates.at(0);
                  if (first) setSelectedCode(first.code);
                })
                .catch((error: unknown) => {
                  const message =
                    error instanceof ChecklistTemplateApiError
                      ? error.message
                      : "We could not load templates. Try again.";
                  setTemplatesState({ status: "error", message });
                });
            }}
          >
            Retry
          </Button>
        </Alert>
      ) : null}

      {templatesState.status === "ready" && templatesState.templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create a checklist template to preview it here."
        />
      ) : null}

      {templatesState.status === "ready" && templatesState.templates.length > 0 ? (
        <Card>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <Input
              label="Search templates"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code or title"
              hint="Filter by template code or title"
            />
            <div
              role="group"
              aria-label="Template status filter"
              style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}
            >
              {(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as StatusFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                  className={[
                    "nelna-segmented-option",
                    "nelna-focusable",
                    statusFilter === value ? "nelna-tone-primary" : "nelna-tone-neutral",
                  ].join(" ")}
                  style={{ minHeight: "var(--nelna-touch-comfortable)" }}
                >
                  {value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {filteredTemplates.length === 0 ? (
              <EmptyState
                title="No matching templates"
                description="Clear search or change the status filter."
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("ALL");
                    }}
                  >
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <div
                role="listbox"
                aria-label="Templates"
                style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
              >
                {filteredTemplates.map((template) => (
                  <Button
                    key={template.code}
                    variant={template.code === selectedCode ? "primary" : "secondary"}
                    aria-selected={template.code === selectedCode}
                    onClick={() => {
                      if (dirty && template.code !== selectedCode) {
                        setPendingHref(`select:${template.code}`);
                        setLeaveOpen(true);
                        return;
                      }
                      setSelectedCode(template.code);
                    }}
                  >
                    {template.code}
                  </Button>
                ))}
              </div>
            )}

            {versionOptions.length > 0 ? (
              <div style={{ maxWidth: "16rem" }}>
                <Select
                  label="Version"
                  options={versionOptions}
                  value={
                    selectedVersionNumber !== null ? String(selectedVersionNumber) : ""
                  }
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (dirty) {
                      setPendingHref(`version:${next}`);
                      setLeaveOpen(true);
                      return;
                    }
                    setSelectedVersionNumber(next);
                  }}
                />
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {versionError ? (
        <Alert tone="danger" title="Could not load this version">
          <p>{versionError}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setVersionError(null);
              if (selectedCode && selectedVersionNumber !== null) {
                setSelectedVersionNumber(selectedVersionNumber);
                versionSeq.current += 1;
                const code = selectedCode;
                const num = selectedVersionNumber;
                setVersionLoading(true);
                fetchTemplateVersion(code, num)
                  .then(setVersion)
                  .catch((error: unknown) => {
                    const message =
                      error instanceof ChecklistTemplateApiError
                        ? error.message
                        : "We could not load this version. Try again.";
                    setVersionError(message);
                  })
                  .finally(() => setVersionLoading(false));
              }
            }}
          >
            Retry
          </Button>
        </Alert>
      ) : null}

      {!versionError && selectedCode && summary && summary.versions.length === 0 ? (
        <EmptyState
          title="No versions yet"
          description={`"${selectedCode}" has no draft or published versions to preview.`}
        />
      ) : null}

      {versionLoading ? <LoadingState message="Loading version…" /> : null}

      {version ? (
        <>
          <Card>
            <h2
              ref={previewHeadingRef}
              tabIndex={-1}
              style={{
                margin: "0 0 0.75rem",
                fontFamily: "var(--nelna-font-display)",
                fontSize: "1.2rem",
                color: "var(--nelna-primary-active)",
              }}
            >
              {version.title}
            </h2>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
                gap: "0.65rem",
                margin: 0,
                fontSize: "0.875rem",
              }}
            >
              <MetaItem label="Template code" value={version.code} />
              <MetaItem label="Version" value={`v${version.versionNumber}`} />
              <MetaItem
                label="Status"
                value={
                  <Badge tone={STATUS_TONE[version.status]}>{version.status}</Badge>
                }
              />
              <MetaItem label="Sections" value={String(counts?.sectionCount ?? 0)} />
              <MetaItem label="Items" value={String(counts?.itemCount ?? 0)} />
              <MetaItem label="Required items" value={String(counts?.requiredCount ?? 0)} />
            </dl>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", color: "var(--nelna-text-muted)" }}>
              Created / published metadata is shown when available on the version record.
              Preview does not persist responses.
            </p>
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
              maxWidth: activeViewport.maxWidth,
              overflowX: "auto",
            }}
          >
            <ChecklistRenderer
              version={version}
              responses={responses}
              onResponsesChange={(next) => {
                setResponses(next);
                setDirty(true);
              }}
              showValidationSummary={showValidationSummary}
            />
          </div>
        </>
      ) : null}

      <ConfirmationDialog
        open={resetOpen}
        title="Reset preview responses?"
        confirmLabel="Reset"
        onCancel={() => setResetOpen(false)}
        onConfirm={resetResponses}
      >
        <p style={{ margin: 0 }}>
          This clears answers entered in preview mode. Nothing was saved to the server.
        </p>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={leaveOpen}
        title="Leave without clearing preview answers?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        onCancel={() => {
          setLeaveOpen(false);
          setPendingHref(null);
        }}
        onConfirm={() => {
          const target = pendingHref;
          setLeaveOpen(false);
          setPendingHref(null);
          setDirty(false);
          setResponses({});
          if (!target) return;
          if (target.startsWith("select:")) {
            setSelectedCode(target.slice("select:".length));
            return;
          }
          if (target.startsWith("version:")) {
            setSelectedVersionNumber(Number(target.slice("version:".length)));
            return;
          }
          window.location.assign(target);
        }}
      >
        <p style={{ margin: 0 }}>
          You have entered preview responses. They will be discarded if you continue.
        </p>
      </ConfirmationDialog>

      <p style={{ fontSize: "0.8rem", color: "var(--nelna-text-muted)" }}>
        Prefer the full template list?{" "}
        <Link href="/admin" className="text-nelna-primary font-semibold">
          Open administration
        </Link>
      </p>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt style={{ color: "var(--nelna-text-secondary)", fontWeight: 600 }}>{label}</dt>
      <dd style={{ margin: "0.15rem 0 0" }}>{value}</dd>
    </div>
  );
}
