"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { InspectionRecordDetail } from "@nelna/shared";
import { RECORD_STATUS_LABELS } from "@nelna/shared";
import { Button, EmptyState, LoadingState, Textarea } from "@nelna/ui";
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

type QueueMode = "check" | "verify";

function failedItems(detail: InspectionRecordDetail) {
  return Object.entries(detail.responses).filter(([, response]) => {
    if (!response?.value || typeof response.value !== "object" || !("value" in response.value)) return false;
    const v = (response.value as { value?: string }).value;
    return v === "FAIL" || v === "UNACCEPTABLE";
  });
}

export function ReviewQueueWorkspace({ mode }: { mode: QueueMode }) {
  const [items, setItems] = useState<InspectionRecordDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = mode === "check" ? await fetchPendingCheckQueue() : await fetchPendingVerificationQueue();
      setItems(list);
      if (list.length > 0) setSelectedId((prev) => prev ?? list[0]!.header.id);
      else setSelectedId(null);
    } catch (err) {
      setError(err instanceof InspectionRecordApiError ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = items.find((i) => i.header.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) {
      setHistory([]);
      return;
    }
    void fetchInspectionApprovals(selectedId)
      .then(setHistory)
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
      if (action === "check") await checkInspectionRecord(selectedId, comment || undefined);
      if (action === "verify") await verifyInspectionRecord(selectedId, comment || undefined);
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-start">
      <section className="w-full md:w-80 md:shrink-0">
        <h1 className="font-display text-xl text-[var(--color-brand-primary)]">
          {mode === "check" ? "Pending check" : "Pending verification"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Exception-first review — failed items shown first. Passed items remain on the record.
        </p>
        {error ? <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p> : null}
        <ul className="mt-4 space-y-2">
          {items.length === 0 ? (
            <EmptyState title="Queue empty" description="No records waiting in this queue." />
          ) : (
            items.map((item) => (
              <li key={item.header.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedId === item.header.id
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-cream)]"
                      : "border-[var(--color-border)]"
                  }`}
                  onClick={() => setSelectedId(item.header.id)}
                >
                  <div className="font-medium">{item.header.documentCode}</div>
                  <div className="text-[var(--color-text-muted)]">
                    {RECORD_STATUS_LABELS[item.header.status]} · {item.header.areaLabel ?? "—"}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
        {!selected ? (
          <EmptyState title="Select a record" description="Choose a record from the queue to review." />
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--color-border)] pb-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.version.title}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {selected.header.recordNumber ?? selected.header.id} ·{" "}
                  {RECORD_STATUS_LABELS[selected.header.status]}
                </p>
                <p className="text-sm">Recorded by: {selected.header.recordedBy.fullName}</p>
              </div>
              <Link className="text-sm text-[var(--color-brand-primary)] underline" href={`/records`}>
                Records list
              </Link>
            </header>

            <div className="mt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Failed / unacceptable items
              </h3>
              <ul className="mt-2 space-y-2">
                {failedItems(selected).length === 0 ? (
                  <li className="text-sm text-[var(--color-text-muted)]">No failed items on this record.</li>
                ) : (
                  failedItems(selected).map(([itemId, response]) => (
                    <li key={itemId} className="rounded-md bg-[var(--color-danger-soft,#fde8e8)] px-3 py-2 text-sm">
                      <div className="font-medium">{itemId}</div>
                      {response.remark ? <div>Remark: {response.remark}</div> : null}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Approval history
              </h3>
              <ol className="mt-2 space-y-1 text-sm">
                {history.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No approvals yet.</li>
                ) : (
                  (history as Array<{ approvalType: string; decision: string; comments?: string | null; decidedAt?: string | null }>).map(
                    (row, idx) => (
                      <li key={idx}>
                        {row.approvalType} · {row.decision}
                        {row.comments ? ` — ${row.comments}` : ""}
                      </li>
                    ),
                  )
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
              />
            </div>

            <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] bg-white py-3">
              {mode === "check" ? (
                <Button type="button" disabled={busy} onClick={() => void runAction("check")}>
                  Check
                </Button>
              ) : (
                <>
                  <Button type="button" disabled={busy} onClick={() => void runAction("verify")}>
                    Verify
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void runAction("reject")}>
                    Reject
                  </Button>
                </>
              )}
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void runAction("return")}>
                Return for correction
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
