/** Emit a browser event so AuthProvider can show the session-expired dialog without marking submissions complete. */
export function notifySessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("nelna:session-expired"));
}

export function notifyForbidden(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("nelna:forbidden"));
}
