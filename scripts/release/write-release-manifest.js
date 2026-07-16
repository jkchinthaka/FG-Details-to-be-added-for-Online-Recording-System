#!/usr/bin/env node
/**
 * Builds an immutable release manifest from the authorized Git SHA.
 * Usage: node scripts/release/write-release-manifest.js [outPath]
 */
const { execSync } = require("node:child_process");
const { writeFileSync, mkdirSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

function git(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

const commitSha = process.env.GIT_COMMIT_SHA?.trim() || git("git rev-parse HEAD");
const buildId =
  process.env.APP_BUILD_ID?.trim() ||
  process.env.GITHUB_RUN_ID?.trim() ||
  commitSha.slice(0, 12);
const applicationVersion = process.env.APP_VERSION?.trim() || "1.0.0";
const environment = process.env.APP_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
const deploymentTimestamp = new Date().toISOString();

const manifest = {
  commitSha,
  buildId,
  applicationVersion,
  environment,
  deploymentTimestamp,
};

const out =
  process.argv[2] ||
  resolve(__dirname, "../../reports/p0/release-manifest.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote release manifest to ${out}`);
console.log(`commitSha=${commitSha.slice(0, 12)} buildId=${buildId}`);
