"use client";

import { Button } from "@nelna/ui";

type SessionExpiredDialogProps = {
  open: boolean;
  onSignIn: () => void;
  /** Local drafts remain on device; do not claim the server submission succeeded. */
  preserveDraftHint?: boolean;
};

/** Modal shown when the API reports session expiry mid-workflow. Does not mark records as submitted. */
export function SessionExpiredDialog({
  open,
  onSignIn,
  preserveDraftHint = true,
}: SessionExpiredDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white p-5 shadow-lg">
        <h2
          id="session-expired-title"
          className="text-nelna-primary-dark text-lg font-bold"
        >
          Session expired
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          Your sign-in session ended. Sign in again to continue. Any unfinished work was
          not submitted to the server.
        </p>
        {preserveDraftHint ? (
          <p className="mt-2 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
            Safe local draft data on this device is kept until you sync or clear it after
            signing in again.
          </p>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={onSignIn}>
            Sign in again
          </Button>
        </div>
      </div>
    </div>
  );
}
