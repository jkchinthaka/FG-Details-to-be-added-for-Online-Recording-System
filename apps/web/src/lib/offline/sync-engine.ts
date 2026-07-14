import {
  nextRetryDelayMs,
  type OfflineConflictReason,
  type SubmitInspectionRecordInput,
} from "@nelna/shared";
import { submitInspectionRecord, InspectionRecordApiError, fetchInspectionRecord } from "@/lib/inspection-records/api";
import {
  clearSyncedOfflineItems,
  getOfflineQueueItem,
  listOfflineQueue,
  setLastSyncAt,
  updateOfflineQueueItem,
  type OfflineQueueItem,
} from "./queue-store";

function classifyConflict(status: number, message: string, serverStatus?: string): OfflineConflictReason | null {
  const lower = message.toLowerCase();
  if (serverStatus === "CHECKED" || serverStatus === "PENDING_VERIFICATION") return "RECORD_ALREADY_CHECKED";
  if (serverStatus === "VERIFIED" || serverStatus === "COMPLETED") return "RECORD_ALREADY_VERIFIED";
  if (serverStatus && serverStatus !== "DRAFT" && serverStatus !== "RETURNED_FOR_CORRECTION") {
    return "SERVER_RECORD_ALREADY_SUBMITTED";
  }
  if (lower.includes("template")) return "TEMPLATE_VERSION_CHANGED";
  if (lower.includes("permission") || status === 403) return "USER_PERMISSION_CHANGED";
  if (lower.includes("date") || lower.includes("task") || lower.includes("assignment")) {
    return "RECORD_DATE_OR_TASK_INVALID";
  }
  if (status === 409) return "SERVER_RECORD_ALREADY_SUBMITTED";
  return null;
}

async function syncOne(item: OfflineQueueItem): Promise<void> {
  await updateOfflineQueueItem(item.id, { state: "SYNCING", lastError: null });

  try {
    const server = await fetchInspectionRecord(item.recordId);
    if (item.serverUpdatedAt && server.header.updatedAt) {
      const local = new Date(item.serverUpdatedAt).getTime();
      const remote = new Date(server.header.updatedAt).getTime();
      if (!Number.isNaN(local) && !Number.isNaN(remote) && remote > local) {
        await updateOfflineQueueItem(item.id, {
          state: "CONFLICT_REQUIRES_REVIEW",
          conflictReason: "NEWER_SERVER_VERSION",
          lastError: "Server record is newer than the offline draft.",
        });
        return;
      }
    }
    if (item.templateVersionNumber != null && server.header.templateVersionNumber !== item.templateVersionNumber) {
      await updateOfflineQueueItem(item.id, {
        state: "CONFLICT_REQUIRES_REVIEW",
        conflictReason: "TEMPLATE_VERSION_CHANGED",
        lastError: "Template version changed since the offline draft was saved.",
      });
      return;
    }
    if (!server.editable) {
      await updateOfflineQueueItem(item.id, {
        state: "CONFLICT_REQUIRES_REVIEW",
        conflictReason: classifyConflict(409, "not editable", server.header.status) ?? "SERVER_RECORD_ALREADY_SUBMITTED",
        lastError: `Record status is ${server.header.status}`,
      });
      return;
    }

    if (item.recordType === "CORRECTIVE_ACTION_DRAFT") {
      // CA draft sync is retained locally until a dedicated CA submit API exists.
      await updateOfflineQueueItem(item.id, {
        state: "SAVED_ON_DEVICE",
        lastError: "Corrective-action online submit API not available; draft kept on device.",
      });
      return;
    }

    await submitInspectionRecord(item.recordId, item.payload as SubmitInspectionRecordInput, item.idempotencyKey);
    await updateOfflineQueueItem(item.id, { state: "SYNCED", conflictReason: null, lastError: null });
  } catch (error) {
    const status = error instanceof InspectionRecordApiError ? error.status : 0;
    const message = error instanceof Error ? error.message : "Sync failed";
    // Duplicate submit after network uncertainty: if server already advanced past draft, treat as synced.
    if (status === 409 || /locked|already|submitted/i.test(message)) {
      try {
        const server = await fetchInspectionRecord(item.recordId);
        if (server.header.status !== "DRAFT" && server.header.status !== "RETURNED_FOR_CORRECTION") {
          await updateOfflineQueueItem(item.id, {
            state: "SYNCED",
            conflictReason: null,
            lastError: null,
          });
          return;
        }
      } catch {
        // fall through to failure handling
      }
    }
    const conflict = classifyConflict(status, message);
    if (conflict) {
      await updateOfflineQueueItem(item.id, {
        state: "CONFLICT_REQUIRES_REVIEW",
        conflictReason: conflict,
        lastError: message,
      });
      return;
    }
    const attemptCount = item.attemptCount + 1;
    const delay = nextRetryDelayMs(attemptCount);
    await updateOfflineQueueItem(item.id, {
      state: "SYNC_FAILED",
      attemptCount,
      lastError: message,
      nextRetryAt: new Date(Date.now() + delay).toISOString(),
    });
  }
}

/** Processes waiting / due failed items. Never reports success unless SYNCED. */
export async function processOfflineQueue(options?: { force?: boolean }): Promise<{ processed: number; synced: number }> {
  if (typeof indexedDB === "undefined") {
    return { processed: 0, synced: 0 };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine && !options?.force) {
    return { processed: 0, synced: 0 };
  }
  const items = await listOfflineQueue();
  const now = Date.now();
  let processed = 0;
  let synced = 0;
  for (const item of items) {
    if (item.state === "SYNCED" || item.state === "CONFLICT_REQUIRES_REVIEW" || item.state === "SYNCING") continue;
    if (item.state === "SAVED_ON_DEVICE") continue;
    if (item.state === "SYNC_FAILED" && item.nextRetryAt && new Date(item.nextRetryAt).getTime() > now && !options?.force) {
      continue;
    }
    if (item.state !== "WAITING_TO_SYNC" && item.state !== "SYNC_FAILED") continue;
    processed += 1;
    await syncOne(item);
    const updated = await getOfflineQueueItem(item.id);
    if (updated?.state === "SYNCED") synced += 1;
  }
  await setLastSyncAt(new Date().toISOString());
  await clearSyncedOfflineItems();
  return { processed, synced };
}

export async function retryOfflineItem(id: string): Promise<void> {
  await updateOfflineQueueItem(id, { state: "WAITING_TO_SYNC", nextRetryAt: null, lastError: null });
  await processOfflineQueue({ force: true });
}
