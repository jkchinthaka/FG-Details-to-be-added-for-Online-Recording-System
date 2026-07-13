"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export type ClearAllBarProps = {
  onClearAll: () => void;
  disabled?: boolean;
  /** Number of items that currently have a response — used for the warning copy. */
  answeredCount?: number;
};

/** Destructive "start over" action, gated behind an explicit confirm dialog
 *  so a stray tap can never wipe out recorded responses. */
export function ClearAllBar({ onClearAll, disabled = false, answeredCount = 0 }: ClearAllBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled || answeredCount === 0}
      >
        Clear all responses
      </Button>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Clear all responses?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onClearAll();
                setConfirmOpen(false);
              }}
            >
              Clear all
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          This removes {answeredCount} recorded response{answeredCount === 1 ? "" : "s"}, including any failure
          notes, corrective actions and photos. This cannot be undone.
        </p>
      </Modal>
    </>
  );
}
