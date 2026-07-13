import { createHash } from "node:crypto";

/**
 * Refresh tokens are JWTs (so they're self-verifying and carry an expiry),
 * but the raw token is also stored — as a SHA-256 hash, never in the clear —
 * in the `RefreshToken` table so a token can be individually looked up,
 * revoked and rotated without needing to load every active token to compare.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
