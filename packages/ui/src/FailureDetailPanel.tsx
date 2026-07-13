import type { EvidencePhoto } from "@nelna/shared";
import { EvidenceUploader } from "./EvidenceUploader";
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
      <Textarea
        label={`What failed?${remarkRequired ? " (required)" : ""}`}
        value={remark}
        onChange={(e) => onRemarkChange(e.target.value)}
        rows={2}
        error={remarkError}
        disabled={disabled}
      />
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
