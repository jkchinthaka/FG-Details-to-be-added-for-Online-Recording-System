#!/usr/bin/env node
/**
 * FG-DEP-001 — Generate an approved release manifest from the current Git commit.
 *
 * Writes:
 *   reports/release/release-manifest.json
 *   apps/web/public/release-manifest.json
 *
 * Never invents a SHA. Never embeds secrets.
 *
 * Usage:
 *   node scripts/release/generate-release-manifest.js
 *   node scripts/release/generate-release-manifest.js --service=nelna-fg-api
 *   node scripts/release/generate-release-manifest.js --environment=production
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

function parseArgs(argv) {
  const args = {
    service: "nelna-fg-monorepo",
    environment: process.env.NELNA_DEPLOY_TIER || process.env.NODE_ENV || "development",
    version: process.env.APP_VERSION || "1.0.0",
  };
  for (const arg of argv) {
    if (arg.startsWith("--service=")) args.service = arg.slice("--service=".length);
    else if (arg.startsWith("--environment="))
      args.environment = arg.slice("--environment=".length);
    else if (arg.startsWith("--version=")) args.version = arg.slice("--version=".length);
  }
  return args;
}

function resolveCommitSha() {
  const fromEnv = [
    process.env.GIT_COMMIT_SHA,
    process.env.APP_BUILD_ID,
    process.env.RENDER_GIT_COMMIT,
    process.env.GITHUB_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
  ]
    .map((v) => (v ?? "").trim().toLowerCase())
    .find((v) => /^[0-9a-f]{40}$/.test(v));
  if (fromEnv) return fromEnv;

  try {
    const sha = execSync("git rev-parse HEAD", {
      cwd: ROOT,
      encoding: "utf8",
    })
      .trim()
      .toLowerCase();
    if (/^[0-9a-f]{40}$/.test(sha)) return sha;
  } catch {
    // fall through
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const commitSha = resolveCommitSha();
  if (!commitSha) {
    console.error(
      "FATAL: could not resolve a 40-char Git commit SHA (set GIT_COMMIT_SHA or run inside a git checkout)",
    );
    process.exit(1);
  }

  const shortSha = commitSha.slice(0, 12);
  const builtAt = new Date().toISOString();
  const environment = String(args.environment).toLowerCase();
  const envMapped =
    environment === "prod"
      ? "production"
      : environment === "staging"
        ? "uat"
        : ["production", "uat", "development", "test"].includes(environment)
          ? environment
          : "unknown";

  const manifest = {
    commitSha,
    shortSha,
    buildId: shortSha,
    applicationVersion: args.version,
    environment: envMapped,
    builtAt,
    deployedAt: null,
    service: args.service,
  };

  const targets = [
    path.join(ROOT, "reports", "release", "release-manifest.json"),
    path.join(ROOT, "apps", "web", "public", "release-manifest.json"),
  ];

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`wrote ${path.relative(ROOT, target)} (${shortSha})`);
  }

  // Export for subsequent build steps (Render / Cloudflare / CI).
  process.stdout.write(`GIT_COMMIT_SHA=${commitSha}\n`);
  process.stdout.write(`APP_BUILD_ID=${commitSha}\n`);
}

main();
