"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, EmptyState, PageHeader } from "@nelna/ui";
import { deleteOfflineQueueItem, listOfflineQueue, type OfflineQueueItem } from "@/lib/offline/queue-store";
import { retryOfflineItem } from "@/lib/offline/sync-engine";

export default function OfflineConflictsPage() {
  const [items, setItems] = useState<OfflineQueueItem[]>([]);

  async function reload() {
    const all = await listOfflineQueue();
    setItems(all.filter((i) => i.state === "CONFLICT_REQUIRES_REVIEW" || i.state === "SYNC_FAILED"));
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Offline"
        title="Conflict review"
        description="Offline drafts that could not sync safely. Server-verified records are never overwritten by older device data."
      />
      {items.length === 0 ? (
        <EmptyState title="No conflicts" description="Queued offline work is clear." />
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <p className="font-semibold text-nelna-primary-dark">
              {item.recordType} · {item.recordId}
            </p>
            <p className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
              State: {item.state}
              {item.conflictReason ? ` · ${item.conflictReason}` : ""}
            </p>
            {item.lastError ? <p className="mt-1 text-sm">{item.lastError}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => void retryOfflineItem(item.id).then(reload)}>
                Retry
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void deleteOfflineQueueItem(item.id).then(reload)}
              >
                Discard device draft
              </Button>
              <Link href={`/records`} className="inline-flex items-center font-semibold text-nelna-primary">
                Open records →
              </Link>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
