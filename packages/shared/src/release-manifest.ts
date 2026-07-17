/**
 * FG-DEP-001 — Safe release build alignment metadata.
 *
 * The authoritative release identifier is the Git commit SHA that both the
 * Cloudflare Worker and the Render API were built from. Never use a random
 * Next.js / OpenNext build id as the release id.
 *
 * Public payloads must never include secrets, hostnames, credentials or
 * database connection details.
 */

export const RELEASE_SHA_FULL_RE = /^[0-9a-f]{40}$/i;
export const RELEASE_SHA_SHORT_RE = /^[0-9a-f]{7,12}$/i;

export type ReleaseEnvironment =
  "production" | "uat" | "development" | "test" | "unknown";

export type ReleaseManifest = {
  /** Full 40-char Git commit SHA — the authoritative release id. */
  commitSha: string;
  /** First 12 characters of commitSha — safe for support UI. */
  shortSha: string;
  /**
   * Build identifier. MUST equal shortSha (or the full commit SHA) so the
   * release is always tied to an immutable Git commit, never a random
   * framework build id.
   */
  buildId: string;
  /** Semver / product version label (e.g. 1.0.0). */
  applicationVersion: string;
  environment: ReleaseEnvironment;
  /** ISO timestamp when this artifact was built. */
  builtAt: string;
  /** ISO timestamp when this process started serving traffic (optional). */
  deployedAt: string | null;
  /** Logical service name (e.g. nelna-fg-api, fgdetails). */
  service: string;
};

export type ReleaseManifestInput = {
  commitSha: string;
  applicationVersion?: string;
  environment?: string;
  builtAt?: string;
  deployedAt?: string | null;
  service: string;
  /** When provided must match shortSha or commitSha — otherwise rejected. */
  buildId?: string;
};

export type ReleaseManifestValidation =
  | { ok: true; manifest: ReleaseManifest }
  | { ok: false; code: ReleaseManifestErrorCode; message: string };

export type ReleaseManifestErrorCode =
  | "MISSING_SHA"
  | "MALFORMED_SHA"
  | "BUILD_ID_MISMATCH"
  | "MISSING_SERVICE"
  | "ENVIRONMENT_MISMATCH";

/** Normalize and validate a candidate commit SHA. Returns lowercase full SHA. */
export function normalizeCommitSha(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (RELEASE_SHA_FULL_RE.test(trimmed)) return trimmed;
  return null;
}

export function shortShaFrom(commitSha: string): string {
  return commitSha.slice(0, 12);
}

export function resolveReleaseEnvironment(
  raw: string | null | undefined,
): ReleaseEnvironment {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "production" || value === "prod") return "production";
  if (value === "uat" || value === "staging") return "uat";
  if (value === "test") return "test";
  if (value === "development" || value === "dev") return "development";
  return "unknown";
}

/**
 * Build a validated release manifest. Fails closed on missing/malformed SHA
 * or when a supplied buildId is not derived from the commit.
 */
export function buildReleaseManifest(
  input: ReleaseManifestInput,
): ReleaseManifestValidation {
  const commitSha = normalizeCommitSha(input.commitSha);
  if (!input.commitSha?.trim()) {
    return { ok: false, code: "MISSING_SHA", message: "commitSha is required" };
  }
  if (!commitSha) {
    return {
      ok: false,
      code: "MALFORMED_SHA",
      message: "commitSha must be a 40-character hexadecimal Git SHA",
    };
  }
  if (!input.service?.trim()) {
    return { ok: false, code: "MISSING_SERVICE", message: "service is required" };
  }

  const shortSha = shortShaFrom(commitSha);
  const buildId = (input.buildId ?? shortSha).trim().toLowerCase();
  if (buildId !== shortSha && buildId !== commitSha) {
    return {
      ok: false,
      code: "BUILD_ID_MISMATCH",
      message: "buildId must equal shortSha or the full commitSha",
    };
  }

  return {
    ok: true,
    manifest: {
      commitSha,
      shortSha,
      buildId: shortSha,
      applicationVersion: input.applicationVersion?.trim() || "1.0.0",
      environment: resolveReleaseEnvironment(input.environment),
      builtAt: input.builtAt ?? new Date().toISOString(),
      deployedAt: input.deployedAt === undefined ? null : input.deployedAt,
      service: input.service.trim(),
    },
  };
}

/**
 * Compare two release manifests for deployment alignment.
 * Frontend and API must share the same commitSha (and preferably environment).
 */
export function compareReleaseManifests(
  expected: { commitSha: string; environment?: ReleaseEnvironment },
  actual: ReleaseManifest | null | undefined,
  label: string,
): { ok: true } | { ok: false; code: string; message: string } {
  if (!actual) {
    return {
      ok: false,
      code: "MISSING_MANIFEST",
      message: `${label} release manifest is missing`,
    };
  }
  const expectedSha = normalizeCommitSha(expected.commitSha);
  if (!expectedSha) {
    return {
      ok: false,
      code: "MALFORMED_SHA",
      message: "expected commitSha is malformed",
    };
  }
  if (!normalizeCommitSha(actual.commitSha)) {
    return {
      ok: false,
      code: "MALFORMED_SHA",
      message: `${label} commitSha is malformed`,
    };
  }
  if (actual.commitSha !== expectedSha) {
    return {
      ok: false,
      code: "SHA_MISMATCH",
      message: `${label} commitSha ${actual.shortSha} does not match expected ${shortShaFrom(expectedSha)}`,
    };
  }
  if (
    expected.environment &&
    expected.environment !== "unknown" &&
    actual.environment !== "unknown" &&
    actual.environment !== expected.environment
  ) {
    return {
      ok: false,
      code: "ENVIRONMENT_MISMATCH",
      message: `${label} environment ${actual.environment} does not match expected ${expected.environment}`,
    };
  }
  return { ok: true };
}

/**
 * Resolve the authoritative commit SHA from process env, preferring explicit
 * Git SHA variables over framework-specific ones. Never invents a SHA.
 */
export function resolveCommitShaFromEnv(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): string | null {
  const candidates = [
    env.GIT_COMMIT_SHA,
    env.APP_BUILD_ID,
    env.RENDER_GIT_COMMIT,
    env.CF_PAGES_COMMIT_SHA,
    env.GITHUB_SHA,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeCommitSha(candidate);
    if (normalized) return normalized;
    // Accept a short SHA only when it is the sole available value — promote
    // it to a placeholder full SHA by left-padding is NOT allowed. Reject.
    if (candidate?.trim() && RELEASE_SHA_SHORT_RE.test(candidate.trim())) {
      // Short SHA alone is not authoritative for alignment — callers must
      // supply the full 40-char SHA. Treat as missing.
      continue;
    }
  }
  return null;
}
