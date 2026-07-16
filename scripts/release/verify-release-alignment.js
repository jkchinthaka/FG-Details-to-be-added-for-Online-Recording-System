#!/usr/bin/env node
/**
 * Fails when frontend and API public commit SHAs differ.
 * Expects RELEASE_API_URL and RELEASE_WEB_URL (or uses health endpoints).
 * Does not print secrets.
 */
const apiUrl =
  process.env.RELEASE_API_HEALTH_URL ||
  process.env.RELEASE_API_URL ||
  "http://127.0.0.1:3001/health";
const webUrl =
  process.env.RELEASE_WEB_HEALTH_URL ||
  process.env.RELEASE_WEB_URL ||
  "http://127.0.0.1:3000/api/health";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

function normalizeSha(value) {
  if (!value || typeof value !== "string") return null;
  return value.trim().toLowerCase().slice(0, 12);
}

async function main() {
  if (process.env.SKIP_RELEASE_ALIGNMENT === "1") {
    console.log("SKIP_RELEASE_ALIGNMENT=1 — skipping live SHA comparison");
    process.exit(0);
  }

  const [api, web] = await Promise.all([fetchJson(apiUrl), fetchJson(webUrl)]);
  const apiSha = normalizeSha(api.buildId || api.commitSha);
  const webSha = normalizeSha(web.buildId || web.commitSha);

  if (!apiSha || !webSha) {
    console.error(
      "Release alignment FAIL: missing buildId/commitSha on API or web health payload",
    );
    process.exit(1);
  }

  if (apiSha !== webSha) {
    console.error(
      `Release alignment FAIL: API=${apiSha} web=${webSha}`,
    );
    process.exit(1);
  }

  console.log(`Release alignment PASS: ${apiSha}`);
}

main().catch((error) => {
  console.error(`Release alignment FAIL: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
