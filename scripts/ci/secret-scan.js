#!/usr/bin/env node
/**
 * FG-CI-001 — lightweight secret scan over tracked files.
 * Fails on high-confidence embedded credential patterns.
 * Allows known-safe fixtures (seed placeholders, test-only strings).
 */
"use strict";

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

const ALLOW_PATH_FRAGMENTS = [
  "docs/",
  ".env.example",
  ".env.test.example",
  "scripts/ci/secret-scan.js",
  "apps/api/prisma/seed-data.ts",
  "apps/api/prisma/seed.ts",
  "apps/e2e/tests/",
  ".github/workflows/",
  "packages/shared/src/password-strength",
];

/** Returns true when every embedded Mongo URI uses known fixture credentials. */
function onlyPlaceholderMongoCreds(text) {
  return !hasNonPlaceholderMongo(text);
}

const PATTERNS = [
  {
    name: "private-key-block",
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "aws-access-key",
    re: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: "github-pat",
    re: /\bghp_[A-Za-z0-9]{36}\b/,
  },
  {
    name: "slack-token",
    re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    name: "mongodb-uri-with-credentials",
    re: /mongodb(?:\+srv)?:\/\/[^/\s:]+:[^/\s@]+@/,
    allowIf: onlyPlaceholderMongoCreds,
  },
  {
    name: "generic-api-key-assignment",
    re: /(?:api[_-]?key|secret[_-]?key|private[_-]?key)\s*[:=]\s*["'](?!test|example|changeme|your-|xxx|placeholder)[^"']{16,}["']/i,
  },
];

function hasNonPlaceholderMongo(text) {
  const re = /mongodb(?:\+srv)?:\/\/([^/\s:]+):([^/\s@]+)@/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const user = match[1];
    const pass = match[2];
    const placeholderUser = /^(USER|user|u|testuser|admin)$/i.test(user);
    const placeholderPass =
      /^(PASSWORD|password|pass|p|secret|SecretPass|SuperSecret99|FakePasswordForRedactionTest99)$/i.test(
        pass,
      );
    if (!placeholderUser || !placeholderPass) {
      return true;
    }
  }
  return false;
}

function listTrackedFiles() {
  const out = execSync("git ls-files -z", { cwd: ROOT, encoding: "buffer" });
  return out
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter(
      (f) => !f.includes("node_modules/") && !f.endsWith(".png") && !f.endsWith(".jpg"),
    );
}

function isAllowed(file) {
  const normalized = file.replace(/\\/g, "/");
  return ALLOW_PATH_FRAGMENTS.some((frag) => normalized.includes(frag));
}

function main() {
  const files = listTrackedFiles();
  const findings = [];

  for (const file of files) {
    if (isAllowed(file)) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(ROOT, file), "utf8");
    } catch {
      continue;
    }
    // Skip binary-ish
    if (text.includes("\u0000")) continue;

    for (const pattern of PATTERNS) {
      if (!pattern.re.test(text)) continue;
      if (typeof pattern.allowIf === "function" && pattern.allowIf(text)) continue;
      findings.push({ file, name: pattern.name });
    }
  }

  if (findings.length > 0) {
    console.error("Secret scan FAILED:");
    for (const f of findings) {
      console.error(`  [${f.name}] ${f.file}`);
    }
    process.exit(1);
  }

  console.log(`Secret scan passed (${files.length} tracked files checked).`);
}

main();
