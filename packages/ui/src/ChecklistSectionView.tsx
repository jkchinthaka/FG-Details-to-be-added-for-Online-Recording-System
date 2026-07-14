import {
  computeSectionProgress,
  type ChecklistResponseMap,
  type ChecklistSectionDefinition,
  type ChecklistItemResponse,
  type ChecklistValidationError,
} from "@nelna/shared";
import { Card } from "./Card";
import { ProgressIndicator } from "./ProgressIndicator";
import { ChecklistItemCard } from "./ChecklistItemCard";

export type ChecklistSectionViewProps = {
  section: ChecklistSectionDefinition;
  responses: ChecklistResponseMap;
  onItemChange: (response: ChecklistItemResponse) => void;
  errors?: ChecklistValidationError[];
  disabled?: boolean;
  /** Registers the item's DOM node so a validation summary can scroll to it. */
  registerItemRef?: (itemId: string, node: HTMLDivElement | null) => void;
};

function errorsForItem(
  errors: ChecklistValidationError[],
  itemId: string,
  code: ChecklistValidationError["code"],
) {
  return errors.find((error) => error.itemId === itemId && error.code === code)?.message;
}

/** One checklist section: name, section-level progress, and its items in
 *  sort order. Purely presentational — all state lives with the caller. */
export function ChecklistSectionView({
  section,
  responses,
  onItemChange,
  errors = [],
  disabled = false,
  registerItemRef,
}: ChecklistSectionViewProps) {
  const progress = computeSectionProgress(section, responses);
  const items = [...section.items].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Card padding="lg" role="region" aria-label={section.name}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "1rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--nelna-font-display)",
            fontSize: "1.15rem",
            color: "var(--nelna-primary-active)",
          }}
        >
          {section.name}
        </h3>
      </div>
      <div style={{ marginTop: "0.5rem", marginBottom: "0.75rem" }}>
        <ProgressIndicator
          value={progress.percent}
          label={`${progress.answered} / ${progress.total} answered`}
        />
      </div>
      <div style={{ display: "grid" }}>
        {items.map((item) => (
          <div
            key={item.id}
            ref={registerItemRef ? (node) => registerItemRef(item.id, node) : undefined}
          >
            <ChecklistItemCard
              item={item}
              response={responses[item.id]}
              onChange={onItemChange}
              disabled={disabled}
              error={
                errorsForItem(errors, item.id, "REQUIRED") ??
                errorsForItem(errors, item.id, "NOT_APPLICABLE_NOT_ALLOWED")
              }
              remarkError={errorsForItem(errors, item.id, "REMARK_REQUIRED")}
              correctiveActionError={errorsForItem(
                errors,
                item.id,
                "CORRECTIVE_ACTION_REQUIRED",
              )}
              evidenceError={errorsForItem(errors, item.id, "EVIDENCE_REQUIRED")}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
