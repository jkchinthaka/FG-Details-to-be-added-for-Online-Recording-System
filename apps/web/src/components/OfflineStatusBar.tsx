"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@nelna/ui";
import { getLastSyncAt, listOfflineQueue, type OfflineQueueItem } from "@/lib/offline/queue-store";
import { processOfflineQueue, retryOfflineItem } from "@/lib/offline/sync-engine";

export function OfflineStatusBar() {
  const [online, setOnline] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pending, setPending] = useState<OfflineQueueItem[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setLastSyncAt(await getLastSyncAt());
    const items = await listOfflineQueue();
    setPending(items.filter((i) => i.state !== "SYNCED"));
  }, []);

  useEffect(() => {
    void refresh();
    function onOnline() {
      setOnline(true);
      void processOfflineQueue().then(() => refresh());
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const conflicts = pending.filter((i) => i.state === "CONFLICT_REQUIRES_REVIEW").length;
  const waiting = pending.filter((i) => i.state === "WAITING_TO_SYNC" || i.state === "SYNC_FAILED").length;

  if (online && waiting === 0 && conflicts === 0) {
    return null;
  }

  return (
    <div className="mb-3 rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-[var(--nelna-surface-muted)] px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong>{online ? "Online" : "Offline"}</strong>
          {lastSyncAt ? (
            <span className="ml-2 text-[var(--nelna-text-secondary)]">
              Last sync {new Date(lastSyncAt).toLocaleString()}
            </span>
          ) : null}
          {waiting > 0 ? <span className="ml-2">{waiting} waiting to sync</span> : null}
          {conflicts > 0 ? (
            <span className="ml-2">
              {conflicts} conflict(s) —{" "}
              <Link href="/offline/conflicts" className="font-semibold text-nelna-primary">
                review
              </Link>
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={!online || busy || waiting === 0}
          onClick={() => {
            setBusy(true);
            void processOfflineQueue({ force: true })
              .then(() => refresh())
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Syncing…" : "Retry sync"}
        </Button>
      </div>
      {pending.slice(0, 3).map((item) => (
        <div key={item.id} className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span>
            {item.recordType} · {item.state}
            {item.lastError ? ` — ${item.lastError}` : ""}
          </span>
          {item.state === "SYNC_FAILED" ? (
            <button
              type="button"
              className="font-semibold text-nelna-primary"
              onClick={() => void retryOfflineItem(item.id).then(() => refresh())}
            >
              Retry
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
