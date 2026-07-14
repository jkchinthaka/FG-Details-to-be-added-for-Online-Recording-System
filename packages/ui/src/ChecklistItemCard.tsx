import type { ChangeEvent } from "react";
import {
  CHECKLIST_ITEM_TYPE_META,
  FAILURE_CORRECTION_OPTIONS,
  FAILURE_ISSUE_REASON_OPTIONS,
  isFailureResponse,
  isStatusItemType,
  type ChecklistItemDefinition,
  type ChecklistItemResponse,
  type ChecklistItemValue,
  type EvidencePhoto,
  type NormalizedStatusValue,
} from "@nelna/shared";
import { FailureDetailPanel } from "./FailureDetailPanel";
import { EvidenceUploader } from "./EvidenceUploader";
import { Input } from "./Input";
import { Select } from "./Select";
import { Textarea } from "./Textarea";
import {
  SegmentedStatusSelector,
  type SegmentedStatusTone,
} from "./SegmentedStatusSelector";

export type ChecklistItemCardProps = {
  item: ChecklistItemDefinition;
  response: ChecklistItemResponse | undefined;
  onChange: (response: ChecklistItemResponse) => void;
  /** General "unanswered" / N/A-not-allowed error text for this item. */
  error?: string;
  remarkError?: string;
  correctiveActionError?: string;
  evidenceError?: string;
  disabled?: boolean;
};

const STATUS_TONE: Record<NormalizedStatusValue, SegmentedStatusTone> = {
  PASS: "success",
  FAIL: "danger",
  NOT_APPLICABLE: "neutral",
};

function emptyResponse(itemId: string): ChecklistItemResponse {
  return { itemId, value: null };
}

function statusValue(value: ChecklistItemValue | null): NormalizedStatusValue | null {
  return value && value.kind === "status" ? value.value : null;
}
function textValue(value: ChecklistItemValue | null): string {
  return value && value.kind === "text" ? value.value : "";
}
function numberValue(value: ChecklistItemValue | null): number | "" {
  return value && value.kind === "number" ? value.value : "";
}
function dateValue(value: ChecklistItemValue | null): string {
  return value && value.kind === "date" ? value.value : "";
}
function timeValue(value: ChecklistItemValue | null): string {
  return value && value.kind === "time" ? value.value : "";
}
function selectValue(value: ChecklistItemValue | null): string {
  return value && value.kind === "select" ? value.value : "";
}
function photoValue(value: ChecklistItemValue | null): EvidencePhoto[] {
  return value && value.kind === "photo" ? value.value : [];
}
function signatureName(value: ChecklistItemValue | null): string {
  return value && value.kind === "signature" ? value.value.signedByName : "";
}
function signatureSignedAt(value: ChecklistItemValue | null): string | null {
  return value && value.kind === "signature" ? value.value.signedAt : null;
}

/**
 * One checklist item, rendered with whatever control its `itemType` calls
 * for, plus the failure detail panel once the current response is a
 * failure. Fully controlled — the caller owns all state (autosave-ready).
 */
export function ChecklistItemCard({
  item,
  response,
  onChange,
  error,
  remarkError,
  correctiveActionError,
  evidenceError,
  disabled = false,
}: ChecklistItemCardProps) {
  const meta = CHECKLIST_ITEM_TYPE_META[item.itemType];
  const current = response ?? emptyResponse(item.id);
  const failed = isFailureResponse(item, current);

  function setValue(value: ChecklistItemValue | null) {
    onChange({ ...current, value });
  }
  function setRemark(remark: string) {
    onChange({ ...current, remark });
  }
  function setCorrectiveAction(correctiveAction: string) {
    onChange({ ...current, correctiveAction });
  }
  function setEvidence(evidence: EvidencePhoto[]) {
    onChange({ ...current, evidence });
  }
  function setIssueReason(issueReason: string) {
    onChange({ ...current, issueReason });
  }
  function setCorrection(correction: string) {
    onChange({ ...current, correction });
  }

  // Quick-choice reason/correction pickers only make sense for the
  // segmented Pass/Fail-style items — free text/number/etc. responses have
  // no well-defined "issue reason" vocabulary.
  const showQuickChoices = isStatusItemType(item.itemType);

  return (
    <div
      style={{
        padding: "1rem",
        borderBottom: "1px solid var(--nelna-border)",
        background: failed ? "var(--nelna-danger-bg)" : "var(--nelna-surface)",
      }}
    >
      <div style={{ display: "grid", gap: "0.65rem" }}>
        <div>
          <span
            style={{
              fontFamily: "var(--nelna-font-sans)",
              fontWeight: 600,
              fontSize: "1.05rem",
              color: "var(--nelna-text)",
            }}
          >
            {item.label}
            {item.isRequired ? (
              <span aria-hidden style={{ color: "var(--nelna-danger)" }}>
                {" "}
                *
              </span>
            ) : null}
          </span>
          {item.helpText ? (
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.85rem",
                color: "var(--nelna-text-muted)",
              }}
            >
              {item.helpText}
            </p>
          ) : null}
        </div>

        {renderControl()}
      </div>

      {failed ? (
        <FailureDetailPanel
          remarkRequired={item.remarkRequiredOnFail}
          correctiveActionRequired={item.correctiveActionRequiredOnFail}
          evidenceRequired={item.requiresEvidenceOnFail}
          remark={current.remark ?? ""}
          onRemarkChange={setRemark}
          correctiveAction={current.correctiveAction ?? ""}
          onCorrectiveActionChange={setCorrectiveAction}
          evidence={current.evidence ?? []}
          onEvidenceChange={setEvidence}
          remarkError={remarkError}
          correctiveActionError={correctiveActionError}
          evidenceError={evidenceError}
          disabled={disabled}
          issueReason={current.issueReason}
          onIssueReasonChange={showQuickChoices ? setIssueReason : undefined}
          issueReasonOptions={showQuickChoices ? FAILURE_ISSUE_REASON_OPTIONS : undefined}
          correction={current.correction}
          onCorrectionChange={showQuickChoices ? setCorrection : undefined}
          correctionOptions={showQuickChoices ? FAILURE_CORRECTION_OPTIONS : undefined}
        />
      ) : null}

      {item.isCriticalFailure && failed ? (
        <p
          role="alert"
          style={{
            margin: "0.6rem 0 0",
            fontWeight: 700,
            fontSize: "0.85rem",
            color: "var(--nelna-danger)",
          }}
        >
          Critical failure
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          style={{
            margin: "0.5rem 0 0",
            color: "var(--nelna-danger)",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );

  function renderControl() {
    switch (meta.control) {
      case "status": {
        const options = (meta.statusOptions ?? []).filter(
          (option) => option.value !== "NOT_APPLICABLE" || item.allowNotApplicable,
        );
        return (
          <SegmentedStatusSelector
            label={`${item.label} result`}
            value={statusValue(current.value)}
            options={options.map((option) => ({
              value: option.value,
              label: option.label,
              tone: STATUS_TONE[option.value],
            }))}
            onChange={(value) => setValue({ kind: "status", value })}
            name={item.id}
            disabled={disabled}
          />
        );
      }
      case "short_text":
        return (
          <Input
            label="Response"
            hideLabel
            value={textValue(current.value)}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setValue({ kind: "text", value: e.target.value })
            }
            disabled={disabled}
            maxLength={500}
          />
        );
      case "long_text":
        return (
          <Textarea
            label="Response"
            hideLabel
            value={textValue(current.value)}
            onChange={(e) => setValue({ kind: "text", value: e.target.value })}
            disabled={disabled}
            maxLength={2000}
          />
        );
      case "number":
      case "temperature": {
        const hint =
          typeof item.minValue === "number" || typeof item.maxValue === "number"
            ? `Allowed range: ${item.minValue ?? "–∞"} to ${item.maxValue ?? "+∞"}${meta.control === "temperature" ? " °C" : ""}`
            : undefined;
        return (
          <Input
            label="Response"
            hideLabel
            type="number"
            inputMode="decimal"
            value={numberValue(current.value)}
            hint={hint}
            error={failed ? "Outside the allowed range" : undefined}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const raw = e.target.value;
              setValue(raw === "" ? null : { kind: "number", value: Number(raw) });
            }}
            disabled={disabled}
          />
        );
      }
      case "date":
        return (
          <Input
            label="Response"
            hideLabel
            type="date"
            value={dateValue(current.value)}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setValue({ kind: "date", value: e.target.value })
            }
            disabled={disabled}
          />
        );
      case "time":
        return (
          <Input
            label="Response"
            hideLabel
            type="time"
            value={timeValue(current.value)}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setValue({ kind: "time", value: e.target.value })
            }
            disabled={disabled}
          />
        );
      case "single_select":
        return (
          <Select
            label="Response"
            placeholder="Select…"
            options={item.options.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            value={selectValue(current.value)}
            onChange={(e) => setValue({ kind: "select", value: e.target.value })}
            disabled={disabled}
          />
        );
      case "photo":
        return (
          <EvidenceUploader
            label="Response photo"
            value={photoValue(current.value)}
            onChange={(photos) =>
              setValue(photos.length > 0 ? { kind: "photo", value: photos } : null)
            }
            disabled={disabled}
          />
        );
      case "signature": {
        const signedAt = signatureSignedAt(current.value);
        return (
          <Input
            label="Signed by"
            hideLabel
            placeholder="Type full name to sign"
            value={signatureName(current.value)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const signedByName = e.target.value;
              setValue(
                signedByName.trim().length > 0
                  ? {
                      kind: "signature",
                      value: {
                        signedByName,
                        signedAt: signedAt ?? new Date().toISOString(),
                      },
                    }
                  : null,
              );
            }}
            disabled={disabled}
            hint={signedAt ? `Signed ${new Date(signedAt).toLocaleString()}` : undefined}
          />
        );
      }
      default:
        return null;
    }
  }
}
