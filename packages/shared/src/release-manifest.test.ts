import { describe, expect, it } from "vitest";
import {
  buildReleaseManifest,
  compareReleaseManifests,
  normalizeCommitSha,
  resolveCommitShaFromEnv,
  resolveReleaseEnvironment,
  shortShaFrom,
} from "./release-manifest";

const FULL = "abcdef0123456789abcdef0123456789abcdef01";

describe("normalizeCommitSha", () => {
  it("accepts a 40-char hex SHA", () => {
    expect(normalizeCommitSha(FULL)).toBe(FULL);
    expect(normalizeCommitSha(FULL.toUpperCase())).toBe(FULL);
  });

  it("rejects missing and malformed values", () => {
    expect(normalizeCommitSha(null)).toBeNull();
    expect(normalizeCommitSha("")).toBeNull();
    expect(normalizeCommitSha("not-a-sha")).toBeNull();
    expect(normalizeCommitSha("abcdef0")).toBeNull();
    expect(normalizeCommitSha("g".repeat(40))).toBeNull();
  });
});

describe("buildReleaseManifest", () => {
  it("builds a valid manifest with matching shortSha/buildId", () => {
    const result = buildReleaseManifest({
      commitSha: FULL,
      service: "nelna-fg-api",
      applicationVersion: "1.0.0",
      environment: "production",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.commitSha).toBe(FULL);
    expect(result.manifest.shortSha).toBe(shortShaFrom(FULL));
    expect(result.manifest.buildId).toBe(result.manifest.shortSha);
    expect(result.manifest.service).toBe("nelna-fg-api");
    expect(result.manifest.environment).toBe("production");
  });

  it("rejects missing SHA", () => {
    const result = buildReleaseManifest({ commitSha: "", service: "api" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MISSING_SHA");
  });

  it("rejects malformed SHA", () => {
    const result = buildReleaseManifest({
      commitSha: "deadbeef",
      service: "api",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MALFORMED_SHA");
  });

  it("rejects a random Next-style buildId that is not derived from the commit", () => {
    const result = buildReleaseManifest({
      commitSha: FULL,
      service: "fgdetails",
      buildId: "next-build-abc123xyz",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BUILD_ID_MISMATCH");
  });
});

describe("compareReleaseManifests", () => {
  const base = buildReleaseManifest({
    commitSha: FULL,
    service: "nelna-fg-api",
    environment: "production",
  });
  if (!base.ok) throw new Error("fixture failed");

  it("passes when SHAs match", () => {
    expect(compareReleaseManifests({ commitSha: FULL }, base.manifest).ok).toBe(true);
  });

  it("fails on frontend SHA mismatch", () => {
    const other = buildReleaseManifest({
      commitSha: "1111111111111111111111111111111111111111",
      service: "fgdetails",
      environment: "production",
    });
    if (!other.ok) throw new Error("fixture failed");
    const result = compareReleaseManifests(
      { commitSha: FULL },
      other.manifest,
      "frontend",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SHA_MISMATCH");
  });

  it("fails on missing manifest", () => {
    const result = compareReleaseManifests({ commitSha: FULL }, null, "api");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MISSING_MANIFEST");
  });

  it("fails on environment mismatch", () => {
    const uat = buildReleaseManifest({
      commitSha: FULL,
      service: "nelna-fg-api",
      environment: "uat",
    });
    if (!uat.ok) throw new Error("fixture failed");
    const result = compareReleaseManifests(
      { commitSha: FULL, environment: "production" },
      uat.manifest,
      "api",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ENVIRONMENT_MISMATCH");
  });
});

describe("resolveCommitShaFromEnv", () => {
  it("prefers GIT_COMMIT_SHA", () => {
    expect(
      resolveCommitShaFromEnv({
        GIT_COMMIT_SHA: FULL,
        APP_BUILD_ID: "1111111111111111111111111111111111111111",
      }),
    ).toBe(FULL);
  });

  it("ignores short-only / random build ids", () => {
    expect(resolveCommitShaFromEnv({ APP_BUILD_ID: "abcdef0" })).toBeNull();
    expect(resolveCommitShaFromEnv({ APP_BUILD_ID: "next-xyz" })).toBeNull();
  });
});

describe("resolveReleaseEnvironment", () => {
  it("maps known labels", () => {
    expect(resolveReleaseEnvironment("production")).toBe("production");
    expect(resolveReleaseEnvironment("uat")).toBe("uat");
    expect(resolveReleaseEnvironment("development")).toBe("development");
    expect(resolveReleaseEnvironment("")).toBe("unknown");
  });
});
