/** Deterministic id-safe slug used as a fallback for form field ids (no hooks required). */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "field"
  );
}
