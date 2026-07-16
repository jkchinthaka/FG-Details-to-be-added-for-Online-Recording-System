import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildReleaseManifest,
  resolveCommitShaFromEnv,
  type ReleaseManifest,
} from "@nelna/shared";

const SERVICE_NAME = "fgdetails";
const PROCESS_STARTED_AT = new Date().toISOString();

/**
 * Load the release manifest baked into the Worker/Next build.
 * Preference order:
 *  1. Process env (GIT_COMMIT_SHA / APP_BUILD_ID / RENDER_GIT_COMMIT / GITHUB_SHA)
 *  2. public/release-manifest.json generated at build time
 *
 * Never invents a SHA. Never returns secrets.
 */
export function loadWebReleaseManifest(): ReleaseManifest | null {
  const fromEnv = resolveCommitShaFromEnv();
  if (fromEnv) {
    const built = buildReleaseManifest({
      commitSha: fromEnv,
      applicationVersion: process.env.APP_VERSION?.trim() || "1.0.0",
      environment:
        process.env.NELNA_DEPLOY_TIER?.trim() ||
        process.env.NODE_ENV?.trim() ||
        "development",
      service: SERVICE_NAME,
      deployedAt: PROCESS_STARTED_AT,
      builtAt: process.env.RELEASE_BUILT_AT?.trim() || PROCESS_STARTED_AT,
    });
    return built.ok ? built.manifest : null;
  }

  try {
    const path = join(process.cwd(), "public", "release-manifest.json");
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<ReleaseManifest>;
    if (!raw.commitSha) return null;
    const built = buildReleaseManifest({
      commitSha: raw.commitSha,
      applicationVersion: raw.applicationVersion,
      environment: raw.environment,
      service: raw.service || SERVICE_NAME,
      builtAt: raw.builtAt,
      deployedAt: PROCESS_STARTED_AT,
      buildId: raw.buildId,
    });
    return built.ok ? built.manifest : null;
  } catch {
    return null;
  }
}
