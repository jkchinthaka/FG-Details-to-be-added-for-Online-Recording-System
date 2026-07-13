const DRAFT_PREFIX = "nelna-fg-draft:";

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
