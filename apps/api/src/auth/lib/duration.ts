const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const DURATION_PATTERN = /^(\d+)\s*(ms|s|m|h|d)$/i;

/**
 * Parses simple duration strings such as "15m", "7d", "30s" into milliseconds.
 * Kept intentionally tiny (no extra dependency) — only the units the auth
 * module's TTL env vars actually use are supported.
 */
export function parseDurationMs(input: string): number {
  const match = DURATION_PATTERN.exec(input.trim());
  if (!match) {
    throw new Error(
      `Invalid duration "${input}" — expected a number followed by ms|s|m|h|d (e.g. "15m")`,
    );
  }
  const [, amount, unit] = match as unknown as [string, string, string];
  return Number(amount) * UNIT_TO_MS[unit.toLowerCase()]!;
}
