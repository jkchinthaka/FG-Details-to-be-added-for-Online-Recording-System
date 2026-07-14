const DRAFT_PREFIX = "nelna-fg-draft:";

export type SavedDraft<T> = {
  responses: T;
  savedAt: string;
};

export function loadDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Returns a device backup only when it is newer than the version loaded from
 * the server. This prevents an old offline snapshot from silently overwriting
 * a newer edit made after another user recovered or updated the record.
 */
export function loadRecoverableDraft<T>(
  key: string,
  serverUpdatedAt: string | undefined,
): SavedDraft<T> | null {
  const draft = loadDraft<SavedDraft<T>>(key);
  if (
    !draft ||
    typeof draft !== "object" ||
    typeof draft.savedAt !== "string" ||
    !("responses" in draft)
  ) {
    return null;
  }

  const draftTime = new Date(draft.savedAt).getTime();
  if (Number.isNaN(draftTime)) return null;

  const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : Number.NaN;
  if (!Number.isNaN(serverTime) && draftTime <= serverTime) return null;

  return draft;
}

export function saveDraft<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(value));
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
}

export function formatDraftSavedAt(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return `Draft saved ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
