"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CORRECTIVE_ACTION_STATUS_LABELS,
  type CorrectiveActionDetail,
} from "@nelna/shared";
import { Alert, Badge, Button, Card, LoadingState, Textarea } from "@nelna/ui";
import {
  CorrectiveActionApiError,
  cancelCorrectiveAction,
  completeCorrectiveAction,
  fetchCorrectiveAction,
  rejectCorrectiveAction,
  reopenCorrectiveAction,
  startCorrectiveAction,
  verifyCorrectiveAction,
} from "@/lib/corrective-actions/api";
import { useAuth } from "@/lib/auth/auth-context";

export function CorrectiveActionDetailView({ id }: { id: string }) {
  const { user } = useAuth();
  const canManage = user?.permissions.includes("corrective_actions:manage") ?? false;
  const canVerify = (user?.permissions.includes("records:verify") || canManage) ?? false;
  const [detail, setDetail] = useState<CorrectiveActionDetail | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await fetchCorrectiveAction(id));
    } catch (err) {
      setError(
        err instanceof CorrectiveActionApiError
          ? err.message
          : "Unable to load corrective action",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<CorrectiveActionDetail>) {
    setBusy(true);
    setError(null);
    try {
      setDetail(await action());
      setComment("");
    } catch (err) {
      setError(err instanceof CorrectiveActionApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !error) return <LoadingState message="Loading corrective action…" />;
  if (!detail) return <Alert tone="danger">{error ?? "Not found"}</Alert>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/corrective-actions" className="text-sm text-[var(--color-primary)]">
          ← Back to list
        </Link>
        <div className="flex gap-2">
          <Badge>{CORRECTIVE_ACTION_STATUS_LABELS[detail.status]}</Badge>
          <Badge tone="warning">{detail.priority}</Badge>
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">{detail.title}</h1>
        <p className="text-[var(--color-muted)]">{detail.description}</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Created by</dt>
            <dd>{detail.createdByName}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Assignee</dt>
            <dd>{detail.assignedToName ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Due</dt>
            <dd>{detail.dueDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Evidence</dt>
            <dd>{detail.evidenceCount}</dd>
          </div>
        </dl>
        {detail.completionComment ? (
          <p className="text-sm">
            <strong>Completion:</strong> {detail.completionComment}
          </p>
        ) : null}
        {detail.verificationComment ? (
          <p className="text-sm">
            <strong>Verification:</strong> {detail.verificationComment}
          </p>
        ) : null}
        {detail.rejectionReason ? (
          <p className="text-sm">
            <strong>Rejection:</strong> {detail.rejectionReason}
          </p>
        ) : null}
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {canManage || canVerify ? (
        <Card className="space-y-3 p-4">
          <Textarea
            label="Action comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            {canManage && ["OPEN", "ASSIGNED", "REOPENED"].includes(detail.status) ? (
              <Button
                disabled={busy}
                onClick={() => void run(() => startCorrectiveAction(id))}
              >
                Start
              </Button>
            ) : null}
            {canManage &&
            ["IN_PROGRESS", "ASSIGNED", "OPEN", "REOPENED"].includes(detail.status) ? (
              <Button
                disabled={busy || !comment.trim()}
                onClick={() => void run(() => completeCorrectiveAction(id, comment))}
              >
                Complete
              </Button>
            ) : null}
            {canVerify &&
            ["PENDING_VERIFICATION", "COMPLETED"].includes(detail.status) ? (
              <>
                <Button
                  disabled={busy || !comment.trim()}
                  onClick={() => void run(() => verifyCorrectiveAction(id, comment))}
                >
                  Verify & close
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || !comment.trim()}
                  onClick={() => void run(() => rejectCorrectiveAction(id, comment))}
                >
                  Reject
                </Button>
              </>
            ) : null}
            {canManage && ["REJECTED", "VERIFIED", "CLOSED"].includes(detail.status) ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void run(() => reopenCorrectiveAction(id))}
              >
                Reopen
              </Button>
            ) : null}
            {canManage &&
            ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED", "REJECTED"].includes(
              detail.status,
            ) ? (
              <Button
                variant="danger"
                disabled={busy || !comment.trim()}
                onClick={() => void run(() => cancelCorrectiveAction(id, comment))}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
