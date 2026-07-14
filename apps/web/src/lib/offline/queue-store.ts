import {
  createIdempotencyKey,
  OFFLINE_QUEUE_MAX_ENTRIES,
  type OfflineConflictReason,
  type OfflineQueueRecordType,
  type OfflineQueueState,
} from "@nelna/shared";

const DB_NAME = "nelna-fg-offline";
const DB_VERSION = 1;
const STORE = "submissionQueue";
const META_STORE = "meta";

/** Payload minimized — do not store authentication secrets. */
export type OfflineQueueItem = {
  id: string;
  recordType: OfflineQueueRecordType;
  recordId: string;
  idempotencyKey: string;
  state: OfflineQueueState;
  payload: unknown;
  templateVersionNumber: number | null;
  serverUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  lastError: string | null;
  conflictReason: OfflineConflictReason | null;
  nextRetryAt: string | null;
};

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function listOfflineQueue(): Promise<OfflineQueueItem[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const all = await idbReq(tx.objectStore(STORE).getAll());
  return (all as OfflineQueueItem[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getOfflineQueueItem(id: string): Promise<OfflineQueueItem | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const item = await idbReq(tx.objectStore(STORE).get(id));
  return (item as OfflineQueueItem | undefined) ?? null;
}

export async function enqueueOfflineSubmission(input: {
  recordType: OfflineQueueRecordType;
  recordId: string;
  payload: unknown;
  templateVersionNumber?: number | null;
  serverUpdatedAt?: string | null;
  state?: OfflineQueueState;
}): Promise<OfflineQueueItem> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB unavailable for offline queue");
  }
  const now = new Date().toISOString();
  const item: OfflineQueueItem = {
    id: createIdempotencyKey(),
    recordType: input.recordType,
    recordId: input.recordId,
    idempotencyKey: createIdempotencyKey(),
    state: input.state ?? "WAITING_TO_SYNC",
    payload: input.payload,
    templateVersionNumber: input.templateVersionNumber ?? null,
    serverUpdatedAt: input.serverUpdatedAt ?? null,
    createdAt: now,
    updatedAt: now,
    attemptCount: 0,
    lastError: null,
    conflictReason: null,
    nextRetryAt: null,
  };

  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const existing = (await idbReq(store.getAll())) as OfflineQueueItem[];
  if (existing.length >= OFFLINE_QUEUE_MAX_ENTRIES) {
    const synced = existing.filter((e) => e.state === "SYNCED").sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    if (synced[0]) store.delete(synced[0].id);
    else throw new Error("Offline queue is full. Resolve or delete failed drafts before adding more.");
  }
  store.put(item);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("enqueue failed"));
  });
  return item;
}

export async function updateOfflineQueueItem(
  id: string,
  patch: Partial<OfflineQueueItem>,
): Promise<OfflineQueueItem | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const current = (await idbReq(store.get(id))) as OfflineQueueItem | undefined;
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  store.put(next);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("update failed"));
  });
  return next;
}

export async function deleteOfflineQueueItem(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("delete failed"));
  });
}

export async function clearSyncedOfflineItems(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const items = await listOfflineQueue();
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const item of items) {
    if (item.state === "SYNCED") store.delete(item.id);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("clear synced failed"));
  });
}

export async function clearOfflineQueueOnLogout(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction([STORE, META_STORE], "readwrite");
  tx.objectStore(STORE).clear();
  tx.objectStore(META_STORE).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("logout clear failed"));
  });
}

export async function setLastSyncAt(iso: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).put({ key: "lastSyncAt", value: iso });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("set last sync failed"));
  });
}

export async function getLastSyncAt(): Promise<string | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const row = (await idbReq(tx.objectStore(META_STORE).get("lastSyncAt"))) as { value?: string } | undefined;
  return row?.value ?? null;
}
