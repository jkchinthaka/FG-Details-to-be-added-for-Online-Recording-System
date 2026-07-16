/**
 * Verify frontend and backend expose the same release build ID.
 *
 * Env:
 *   FRONTEND_PUBLIC_URL
 *   API_PUBLIC_URL
 *   EXPECTED_BUILD_ID (optional — when set, both sides must match it)
 *
 * Never prints secrets.
 */
async function fetchJson(url: string): Promise<{ status: number; body: any }> {
  const response = await fetch(url, { method: "GET", redirect: "manual" });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function pickBuildId(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload.buildId ?? payload.build_id ?? payload.commit ?? null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function main(): Promise<void> {
  const frontend = (process.env.FRONTEND_PUBLIC_URL ?? "").replace(/\/$/, "");
  const api = (process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "");
  const expected = (process.env.EXPECTED_BUILD_ID ?? "").trim() || null;

  if (!frontend || !api) {
    throw new Error("FRONTEND_PUBLIC_URL and API_PUBLIC_URL are required");
  }

  const directLive = await fetchJson(`${api}/health/live`);
  const directReady = await fetchJson(`${api}/health/ready`);
  const directHealth = await fetchJson(`${api}/health`);
  const proxiedLive = await fetchJson(`${frontend}/api/health/live`);
  const proxiedReady = await fetchJson(`${frontend}/api/health/ready`);
  const proxiedHealth = await fetchJson(`${frontend}/api/health`);

  const apiBuild = pickBuildId(directHealth.body);
  const frontendBuild = pickBuildId(proxiedHealth.body);

  console.log(`directLive=${directLive.status}`);
  console.log(`directReady=${directReady.status}`);
  console.log(`proxiedLive=${proxiedLive.status}`);
  console.log(`proxiedReady=${proxiedReady.status}`);
  console.log(`apiBuildId=${apiBuild ?? "missing"}`);
  console.log(`frontendBuildId=${frontendBuild ?? "missing"}`);
  console.log(`dbStatus=${directReady.body?.checks?.db ?? "unknown"}`);

  const failures: string[] = [];
  if (directLive.status !== 200) failures.push("direct /health/live not 200");
  if (directReady.status !== 200) failures.push("direct /health/ready not 200");
  if (proxiedLive.status !== 200) failures.push("proxied /api/health/live not 200");
  if (proxiedReady.status !== 200) failures.push("proxied /api/health/ready not 200");
  if (!apiBuild || !frontendBuild) failures.push("build IDs missing");
  if (apiBuild && frontendBuild && apiBuild !== frontendBuild) {
    failures.push("frontend/backend build IDs differ");
  }
  if (expected && (apiBuild !== expected || frontendBuild !== expected)) {
    failures.push("build IDs do not match EXPECTED_BUILD_ID");
  }
  if (directReady.body?.checks?.db !== "up") failures.push("database not up");

  if (failures.length > 0) {
    console.error(`FAILED: ${failures.join("; ")}`);
    process.exit(1);
  }

  console.log("PASS: release alignment verified");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
