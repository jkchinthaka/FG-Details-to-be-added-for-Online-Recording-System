import type { EvidencePhoto } from "@nelna/shared";
import { EvidenceUploader } from "./EvidenceUploader";
import { QuickChoiceField } from "./QuickChoiceField";
import { Textarea } from "./Textarea";

export type FailureDetailPanelProps = {
  remarkRequired?: boolean;
  correctiveActionRequired?: boolean;
  evidenceRequired?: boolean;
  remark: string;
  onRemarkChange: (value: string) => void;
  correctiveAction: string;
  onCorrectiveActionChange: (value: string) => void;
  evidence: EvidencePhoto[];
  onEvidenceChange: (photos: EvidencePhoto[]) => void;
  remarkError?: string;
  correctiveActionError?: string;
  evidenceError?: string;
  disabled?: boolean;
  /** Quick-choice categorized reason for the failure — omitted (no quick
   *  picker shown) when `issueReasonOptions` isn't provided. */
  issueReason?: string;
  onIssueReasonChange?: (value: string) => void;
  issueReasonOptions?: readonly string[];
  /** Quick-choice immediate correction already taken, distinct from the
   *  longer-form `correctiveAction` follow-up. */
  correction?: string;
  onCorrectionChange?: (value: string) => void;
  correctionOptions?: readonly string[];
};

/**
 * Extra detail collected only once an item's response is a failure —
 * never rendered for a passing/N/A/unanswered item, and never responsible
 * for clearing itself when a status flips back to a passing value (the
 * caller/engine owns that decision explicitly).
 */
export function FailureDetailPanel({
  remarkRequired = false,
  correctiveActionRequired = false,
  evidenceRequired = false,
  remark,
  onRemarkChange,
  correctiveAction,
  onCorrectiveActionChange,
  evidence,
  onEvidenceChange,
  remarkError,
  correctiveActionError,
  evidenceError,
  disabled = false,
  issueReason,
  onIssueReasonChange,
  issueReasonOptions,
  correction,
  onCorrectionChange,
  correctionOptions,
}: FailureDetailPanelProps) {
  return (
    <div
      style={{
        marginTop: "0.75rem",
        display: "grid",
        gap: "0.75rem",
        padding: "0.85rem",
        borderRadius: "var(--nelna-radius)",
        border: "1px solid var(--nelna-danger)",
        background: "var(--nelna-danger-bg)",
      }}
    >
      {issueReasonOptions && onIssueReasonChange ? (
        <QuickChoiceField
          label="What's the issue?"
          value={issueReason ?? ""}
          options={issueReasonOptions}
          onChange={onIssueReasonChange}
          disabled={disabled}
        />
      ) : null}
      <Textarea
        label={`What failed?${remarkRequired ? " (required)" : ""}`}
        value={remark}
        onChange={(e) => onRemarkChange(e.target.value)}
        rows={2}
        error={remarkError}
        disabled={disabled}
      />
      {correctionOptions && onCorrectionChange ? (
        <QuickChoiceField
          label="Correction (immediate)"
          value={correction ?? ""}
          options={correctionOptions}
          onChange={onCorrectionChange}
          disabled={disabled}
        />
      ) : null}
      <Textarea
        label={`Corrective action${correctiveActionRequired ? " (required)" : " (optional)"}`}
        value={correctiveAction}
        onChange={(e) => onCorrectiveActionChange(e.target.value)}
        rows={2}
        error={correctiveActionError}
        disabled={disabled}
      />
      <EvidenceUploader
        label={`Photo evidence${evidenceRequired ? " (required)" : " (optional)"}`}
        value={evidence}
        onChange={onEvidenceChange}
        error={evidenceError}
        disabled={disabled}
      />
    </div>
  );
}
