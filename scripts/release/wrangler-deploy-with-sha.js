#!/usr/bin/env node
/**
 * Deploy the OpenNext Worker while injecting the authoritative Git commit SHA
 * as a Worker var (GIT_COMMIT_SHA / APP_BUILD_ID). Never invents a SHA.
 */
const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "../..");
const WEB = path.join(ROOT, "apps", "web");

function resolveSha() {
  const fromEnv = [
    process.env.GIT_COMMIT_SHA,
    process.env.APP_BUILD_ID,
    process.env.GITHUB_SHA,
  ]
    .map((v) => (v ?? "").trim().toLowerCase())
    .find((v) => /^[0-9a-f]{40}$/.test(v));
  if (fromEnv) return fromEnv;
  try {
    const manifestPath = path.join(ROOT, "reports", "release", "release-manifest.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (
        typeof manifest.commitSha === "string" &&
        /^[0-9a-f]{40}$/i.test(manifest.commitSha)
      ) {
        return manifest.commitSha.toLowerCase();
      }
    }
  } catch {
    // fall through
  }
  return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" })
    .trim()
    .toLowerCase();
}

const sha = resolveSha();
if (!/^[0-9a-f]{40}$/.test(sha)) {
  console.error("FATAL: cannot resolve a 40-char Git commit SHA for Worker deploy");
  process.exit(1);
}

const args = process.argv.slice(2).join(" ");
const cmd = [
  "pnpm exec wrangler deploy",
  `--var GIT_COMMIT_SHA:${sha}`,
  `--var APP_BUILD_ID:${sha}`,
  args,
]
  .filter(Boolean)
  .join(" ");

console.log(`Deploying Worker with GIT_COMMIT_SHA=${sha.slice(0, 12)}`);
execSync(cmd, {
  cwd: WEB,
  stdio: "inherit",
  env: { ...process.env, GIT_COMMIT_SHA: sha, APP_BUILD_ID: sha },
});
