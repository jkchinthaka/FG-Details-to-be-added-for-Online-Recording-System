"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { InspectionRecordDetail } from "@nelna/shared";
import { RECORD_STATUS_LABELS } from "@nelna/shared";
import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  PageHeader,
  Textarea,
} from "@nelna/ui";
import {
  checkInspectionRecord,
  fetchInspectionApprovals,
  fetchPendingCheckQueue,
  fetchPendingVerificationQueue,
  rejectInspectionRecord,
  returnInspectionRecord,
  verifyInspectionRecord,
  InspectionRecordApiError,
} from "@/lib/inspection-records/api";
import {
  buildApprovalViews,
  buildFailedItemViews,
  type ReviewApprovalView,
} from "./review-queue-labels";

type QueueMode = "check" | "verify";

export function ReviewQueueWorkspace({ mode }: { mode: QueueMode }) {
  const [items, setItems] = useState<InspectionRecordDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReviewApprovalView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list =
        mode === "check"
          ? await fetchPendingCheckQueue()
          : await fetchPendingVerificationQueue();
      setItems(list);
      if (list.length > 0) setSelectedId((prev) => prev ?? list[0]!.header.id);
      else setSelectedId(null);
    } catch (err) {
      setError(
        err instanceof InspectionRecordApiError ? err.message : "Failed to load queue",
      );
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = items.find((i) => i.header.id === selectedId) ?? null;
  const failed = useMemo(
    () => (selected ? buildFailedItemViews(selected) : []),
    [selected],
  );

  useEffect(() => {
    if (!selectedId) {
      setHistory([]);
      return;
    }
    void fetchInspectionApprovals(selectedId)
      .then((rows) =>
        setHistory(
          buildApprovalViews(
            rows as Array<{
              id?: string;
              approvalType: string;
              decision: string;
              comments?: string | null;
              decidedAt?: string | null;
            }>,
          ),
        ),
      )
      .catch(() => setHistory([]));
  }, [selectedId]);

  async function runAction(action: "check" | "verify" | "return" | "reject") {
    if (!selectedId) return;
    if ((action === "return" || action === "reject") && !comment.trim()) {
      setError("A comment is required for return or reject.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (action === "check")
        await checkInspectionRecord(selectedId, comment || undefined);
      if (action === "verify")
        await verifyInspectionRecord(selectedId, comment || undefined);
      if (action === "return") await returnInspectionRecord(selectedId, comment.trim());
      if (action === "reject") await rejectInspectionRecord(selectedId, comment.trim());
      setComment("");
      await load();
    } catch (err) {
      setError(err instanceof InspectionRecordApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState message="Loading review queue…" />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:flex-row md:items-start">
      <section className="w-full md:w-80 md:shrink-0" aria-label="Review queue list">
        <PageHeader
          title={mode === "check" ? "Pending check" : "Pending verification"}
          description="Exception-first review — failed items shown first. Passed items remain on the record."
        />
        {error ? (
          <p className="mt-2 text-sm" style={{ color: "var(--nelna-danger)" }} role="alert">
            {error}
          </p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {items.length === 0 ? (
            <EmptyState
              title="Queue empty"
              description="No records waiting in this queue."
            />
          ) : (
            items.map((item) => (
              <li key={item.header.id}>
                <button
                  type="button"
                  className="nelna-focusable w-full rounded-[var(--nelna-radius)] border px-3 py-2 text-left text-sm"
                  style={{
                    minHeight: "var(--nelna-touch-min)",
                    borderColor:
                      selectedId === item.header.id
                        ? "var(--nelna-primary)"
                        : "var(--nelna-border)",
                    background:
                      selectedId === item.header.id
                        ? "var(--nelna-surface-muted)"
                        : "var(--nelna-surface)",
                  }}
                  aria-current={selectedId === item.header.id ? "true" : undefined}
                  onClick={() => setSelectedId(item.header.id)}
                >
                  <div className="font-medium">{item.header.documentCode}</div>
                  <div style={{ color: "var(--nelna-text-secondary)" }}>
                    {RECORD_STATUS_LABELS[item.header.status]} ·{" "}
                    {item.header.areaLabel ?? "—"}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section
        className="min-w-0 flex-1 rounded-[var(--nelna-radius-lg)] border bg-white p-4"
        style={{
          borderColor: "var(--nelna-border)",
          boxShadow: "var(--nelna-shadow-sm)",
        }}
        aria-label="Selected record review"
      >
        {!selected ? (
          <EmptyState
            title="Select a record"
            description="Choose a record from the queue to review."
          />
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-2 border-b pb-3"
              style={{ borderColor: "var(--nelna-border)" }}
            >
              <div>
                <h2 className="text-lg font-semibold">{selected.version.title}</h2>
                <p className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
                  {selected.header.recordNumber ?? selected.header.id} ·{" "}
                  {RECORD_STATUS_LABELS[selected.header.status]}
                </p>
                <p className="text-sm">
                  Recorded by: {selected.header.recordedBy.fullName}
                </p>
              </div>
              <Link
                className="nelna-focusable text-sm underline"
                style={{ color: "var(--nelna-primary)", minHeight: "var(--nelna-touch-min)" }}
                href="/records"
              >
                Records list
              </Link>
            </header>

            <div className="mt-4">
              <h3
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--nelna-text-secondary)" }}
              >
                Failed / unacceptable items
              </h3>
              <ul className="mt-2 space-y-2">
                {failed.length === 0 ? (
                  <li className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
                    No failed items on this record.
                  </li>
                ) : (
                  failed.map((item) => (
                    <li
                      key={item.itemId}
                      className="rounded-[var(--nelna-radius-sm)] px-3 py-2 text-sm"
                      style={{ background: "var(--nelna-danger-bg)" }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.label}</span>
                        <Badge
                          tone={item.criticality === "Critical" ? "danger" : "neutral"}
                        >
                          {item.criticality}
                        </Badge>
                        <Badge
                          tone={item.evidenceState === "Missing" ? "warning" : "information"}
                        >
                          Evidence: {item.evidenceState}
                        </Badge>
                      </div>
                      <div style={{ color: "var(--nelna-text-secondary)" }}>
                        Section: {item.sectionName}
                      </div>
                      {item.remark ? <div>Remark: {item.remark}</div> : null}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="mt-4">
              <h3
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--nelna-text-secondary)" }}
              >
                Review chronology
              </h3>
              <ol className="mt-2 space-y-2 text-sm">
                {history.length === 0 ? (
                  <li style={{ color: "var(--nelna-text-secondary)" }}>No approvals yet.</li>
                ) : (
                  history.map((row) => (
                    <li
                      key={row.key}
                      className="rounded-[var(--nelna-radius-sm)] border px-3 py-2"
                      style={{ borderColor: "var(--nelna-border)" }}
                    >
                      <div className="font-medium">
                        {row.actionLabel} — {row.decisionLabel}
                      </div>
                      <div style={{ color: "var(--nelna-text-secondary)" }}>
                        {row.decidedAtLabel}
                      </div>
                      {row.comments ? <div>Reason: {row.comments}</div> : null}
                    </li>
                  ))
                )}
              </ol>
            </div>

            <div className="mt-4">
              <Textarea
                label="Comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Required for return / reject"
                rows={3}
                hint="Explain the decision so operators understand what to correct."
              />
            </div>

            <div
              className="sticky bottom-0 mt-4 flex flex-wrap gap-2 border-t bg-white py-3"
              style={{ borderColor: "var(--nelna-border)" }}
            >
              {mode === "check" ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction("check")}
                >
                  Check
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction("verify")}
                  >
                    Verify
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void runAction("reject")}
                  >
                    Reject
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void runAction("return")}
              >
                Return for correction
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
