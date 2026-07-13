"use client";

import { useMemo, useRef } from "react";
import {
  applyMarkAllAcceptable,
  clearAllResponses,
  computeOverallProgress,
  flattenItems,
  previewMarkAllAcceptable,
  validateChecklistResponses,
  type ChecklistItemResponse,
  type ChecklistResponseMap,
  type ChecklistTemplateVersionDefinition,
} from "@nelna/shared";
import { ProgressIndicator } from "./ProgressIndicator";
import { MarkAllAcceptableBar } from "./MarkAllAcceptableBar";
import { ClearAllBar } from "./ClearAllBar";
import { ChecklistSectionView } from "./ChecklistSectionView";
import { ChecklistValidationSummary } from "./ChecklistValidationSummary";
import { Alert } from "./Alert";

export type ChecklistRendererProps = {
  version: ChecklistTemplateVersionDefinition;
  responses: ChecklistResponseMap;
  onResponsesChange: (next: ChecklistResponseMap) => void;
  disabled?: boolean;
  /** Show the rolled-up validation summary (e.g. after a submit attempt). */
  showValidationSummary?: boolean;
  showMarkAllAcceptable?: boolean;
  showClearAll?: boolean;
};

/**
 * Full dynamic checklist for one template version: overall progress,
 * Mark All Acceptable, sections/items, Clear All and a validation summary —
 * entirely driven by `version` (from `@nelna/shared`'s checklist engine)
 * rather than any page-specific logic. Controlled component; the caller
 * owns `responses` (autosave-ready).
 */
export function ChecklistRenderer({
  version,
  responses,
  onResponsesChange,
  disabled = false,
  showValidationSummary = false,
  showMarkAllAcceptable = true,
  showClearAll = true,
}: ChecklistRendererProps) {
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const items = useMemo(() => flattenItems(version.sections), [version.sections]);
  const overallProgress = useMemo(() => computeOverallProgress(version.sections, responses), [
    version.sections,
    responses,
  ]);
  const markAllPreview = useMemo(() => previewMarkAllAcceptable(items, responses), [items, responses]);
  const validation = useMemo(() => validateChecklistResponses(version.sections, responses), [
    version.sections,
    responses,
  ]);
  // Inline per-item error hints only appear once the caller opts into showing
  // validation state (e.g. after a submit attempt) — never nag before that.
  const displayedErrors = showValidationSummary ? validation.errors : [];
  const answeredCount = useMemo(
    () => Object.values(responses).filter((response) => response.value !== null).length,
    [responses],
  );

  function handleItemChange(response: ChecklistItemResponse) {
    onResponsesChange({ ...responses, [response.itemId]: response });
  }

  function handleMarkAll() {
    onResponsesChange(applyMarkAllAcceptable(items, responses));
  }

  function handleClearAll() {
    onResponsesChange(clearAllResponses());
  }

  function focusItem(itemId: string) {
    const node = itemRefs.current.get(itemId);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    node?.querySelector<HTMLElement>("button, input, textarea, select")?.focus();
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <ProgressIndicator
        value={overallProgress.percent}
        label={`Overall progress — ${overallProgress.answered} / ${overallProgress.total} answered`}
      />

      {validation.hasCriticalFailure ? (
        <Alert tone="danger" title="Critical failure detected">
          {validation.criticalFailureItemIds.length} item{validation.criticalFailureItemIds.length === 1 ? "" : "s"}{" "}
          flagged as a critical failure. This will require escalation before the record can be closed.
        </Alert>
      ) : null}

      {showMarkAllAcceptable ? (
        <MarkAllAcceptableBar
          onMarkAll={handleMarkAll}
          itemCount={markAllPreview.itemIdsToFill.length}
          disabled={disabled || markAllPreview.itemIdsToFill.length === 0}
        />
      ) : null}

      {showValidationSummary ? (
        <ChecklistValidationSummary errors={validation.errors} onFocusItem={focusItem} />
      ) : null}

      {[...version.sections]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((section) => (
          <ChecklistSectionView
            key={section.id}
            section={section}
            responses={responses}
            onItemChange={handleItemChange}
            errors={displayedErrors}
            disabled={disabled}
            registerItemRef={(itemId, node) => {
              if (node) itemRefs.current.set(itemId, node);
              else itemRefs.current.delete(itemId);
            }}
          />
        ))}

      {showClearAll ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <ClearAllBar onClearAll={handleClearAll} disabled={disabled} answeredCount={answeredCount} />
        </div>
      ) : null}
    </div>
  );
}
