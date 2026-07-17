/**
 * FG-DEP-001 — Verify Cloudflare frontend/Worker and Render API run the same
 * authorized Git commit.
 *
 * Env:
 *   EXPECTED_COMMIT_SHA   — authorized full 40-char SHA (required)
 *   FRONTEND_PUBLIC_URL   — e.g. https://fgdetails....workers.dev
 *   API_PUBLIC_URL        — e.g. https://....onrender.com
 *   EXPECTED_ENVIRONMENT  — optional (production|uat|development|test)
 *   LOCAL_MANIFEST_PATH   — optional path to reports/release/release-manifest.json
 *
 * Compares:
 *   - expected authorized SHA
 *   - local build manifest (when present)
 *   - direct Render `/health/release`
 *   - Cloudflare Worker `/release` (and falls back to `/release-manifest.json`)
 *
 * Never prints secrets, cookies, tokens or database URLs.
 *
 * Exit 0 on alignment; exit 1 on any failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  compareReleaseManifests,
  normalizeCommitSha,
  resolveReleaseEnvironment,
  shortShaFrom,
  type ReleaseManifest,
} from "@nelna/shared";

type FetchResult = { status: number; body: unknown; url: string };

async function fetchJson(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: { accept: "application/json" },
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body, url };
}

function asManifest(body: unknown): ReleaseManifest | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Partial<ReleaseManifest>;
  if (typeof candidate.commitSha !== "string") return null;
  if (!normalizeCommitSha(candidate.commitSha)) return null;
  return candidate as ReleaseManifest;
}

function loadLocalManifest(path: string | null): ReleaseManifest | null {
  if (!path || !existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return asManifest(raw);
  } catch {
    return null;
  }
}

function assertSafePayload(label: string, body: unknown, failures: string[]): void {
  const serialized = JSON.stringify(body ?? {});
  const forbidden = [
    /mongodb(\+srv)?:\/\//i,
    /password/i,
    /jwt[_-]?secret/i,
    /bearer\s+[a-z0-9._-]+/i,
    /"DATABASE_URL"/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(serialized)) {
      failures.push(`${label} response appears to contain secret/internal detail`);
      return;
    }
  }
}

async function main(): Promise<void> {
  const frontend = (process.env.FRONTEND_PUBLIC_URL ?? "").replace(/\/$/, "");
  const api = (process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "");
  const expectedRaw = (process.env.EXPECTED_COMMIT_SHA ?? "").trim();
  const expectedEnv = resolveReleaseEnvironment(process.env.EXPECTED_ENVIRONMENT);
  const localPath =
    process.env.LOCAL_MANIFEST_PATH?.trim() ||
    resolve(process.cwd(), "reports/release/release-manifest.json");

  const failures: string[] = [];

  if (!expectedRaw) {
    failures.push("EXPECTED_COMMIT_SHA is required");
  }
  const expectedSha = normalizeCommitSha(expectedRaw);
  if (expectedRaw && !expectedSha) {
    failures.push("EXPECTED_COMMIT_SHA is malformed (need 40-char hex SHA)");
  }
  if (!frontend) failures.push("FRONTEND_PUBLIC_URL is required");
  if (!api) failures.push("API_PUBLIC_URL is required");

  if (failures.length > 0) {
    console.error(`FAILED: ${failures.join("; ")}`);
    process.exit(1);
  }

  const expected = {
    commitSha: expectedSha!,
    environment: expectedEnv === "unknown" ? undefined : expectedEnv,
  };

  console.log(`expectedSha=${shortShaFrom(expected.commitSha)}`);
  if (expected.environment) console.log(`expectedEnvironment=${expected.environment}`);

  const local = loadLocalManifest(localPath);
  if (local) {
    const localCheck = compareReleaseManifests(expected, local, "local");
    console.log(`localManifest=${local.shortSha} service=${local.service}`);
    if (!localCheck.ok) failures.push(localCheck.message);
  } else {
    console.log("localManifest=absent");
  }

  const directRelease = await fetchJson(`${api}/health/release`);
  const directHealth = await fetchJson(`${api}/health`);
  const workerRelease = await fetchJson(`${frontend}/release`);
  const workerStatic = await fetchJson(`${frontend}/release-manifest.json`);

  console.log(`directRelease=${directRelease.status}`);
  console.log(`workerRelease=${workerRelease.status}`);
  console.log(`workerStatic=${workerStatic.status}`);

  assertSafePayload("api /health/release", directRelease.body, failures);
  assertSafePayload("api /health", directHealth.body, failures);
  assertSafePayload("worker /release", workerRelease.body, failures);

  if (directRelease.status !== 200) {
    failures.push(`API release endpoint returned ${directRelease.status}`);
  }
  const apiManifest = asManifest(directRelease.body);
  if (!apiManifest) {
    failures.push("API release manifest missing or malformed");
  } else {
    console.log(`apiCommitSha=${apiManifest.shortSha}`);
    const apiCheck = compareReleaseManifests(expected, apiManifest, "api");
    if (!apiCheck.ok) failures.push(apiCheck.message);
  }

  let frontendManifest = asManifest(workerRelease.body);
  if (!frontendManifest && workerStatic.status === 200) {
    frontendManifest = asManifest(workerStatic.body);
  }
  if (workerRelease.status !== 200 && workerStatic.status !== 200) {
    failures.push(
      `Worker release endpoint returned ${workerRelease.status} (static ${workerStatic.status})`,
    );
  }
  if (!frontendManifest) {
    failures.push("frontend release manifest missing or malformed");
  } else {
    console.log(`frontendCommitSha=${frontendManifest.shortSha}`);
    const feCheck = compareReleaseManifests(expected, frontendManifest, "frontend");
    if (!feCheck.ok) failures.push(feCheck.message);
  }

  if (
    apiManifest &&
    frontendManifest &&
    apiManifest.commitSha !== frontendManifest.commitSha
  ) {
    failures.push(
      `frontend/API mismatch: frontend=${frontendManifest.shortSha} api=${apiManifest.shortSha}`,
    );
  }

  // Stale deployment: health.buildId present but differs from expected short SHA.
  const healthBody = directHealth.body as { buildId?: string; commitSha?: string } | null;
  if (healthBody?.commitSha && normalizeCommitSha(healthBody.commitSha)) {
    if (healthBody.commitSha.toLowerCase() !== expected.commitSha) {
      failures.push("API /health reports a stale commitSha");
    }
  }

  if (failures.length > 0) {
    console.error(`FAILED: ${failures.join("; ")}`);
    process.exit(1);
  }

  console.log("PASS: release alignment verified");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/\/\/[^@\s]+@/g, "//****:****@"));
  process.exit(1);
});
