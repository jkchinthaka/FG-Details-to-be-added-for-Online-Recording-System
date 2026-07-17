#!/usr/bin/env node
/**
 * FG-DR-001 — generate a backup MANIFEST.json from an existing backup directory
 * that already contains per-collection JSON artifacts (e.g. from backup-fg-online.js).
 *
 * Does not connect to MongoDB. Read-only filesystem operation.
 * Never embeds connection strings.
 *
 * Usage:
 *   node scripts/disaster-recovery/generate-backup-manifest.js --dir=.local-backups/<folder> --database=fg_online
 */
"use strict";

const fs = require("fs");
const path = require("path");
const {
  CANONICAL_COLLECTIONS,
  GRIDFS_FILES,
  GRIDFS_CHUNKS,
  sha256,
  buildBackupManifest,
  redactReport,
} = require("./lib/backup-manifest");

function parseArgs(argv) {
  const out = { dir: null, database: null };
  for (const arg of argv) {
    if (arg.startsWith("--dir=")) out.dir = arg.slice(6);
    else if (arg.startsWith("--database=")) out.database = arg.slice(11);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir || !args.database) {
    console.error("Usage: --dir=<backupDir> --database=<name>");
    process.exit(1);
  }
  const backupDir = path.resolve(args.dir);
  if (!fs.existsSync(backupDir)) {
    console.error("Backup directory not found");
    process.exit(1);
  }

  const counts = {};
  const sha256ByRelativePath = {};

  for (const name of [...CANONICAL_COLLECTIONS, GRIDFS_FILES, GRIDFS_CHUNKS]) {
    const rel = `${name}.json`;
    const full = path.join(backupDir, rel);
    if (!fs.existsSync(full)) {
      counts[name] = 0;
      continue;
    }
    const raw = fs.readFileSync(full);
    sha256ByRelativePath[rel] = sha256(raw);
    try {
      const parsed = JSON.parse(raw.toString("utf8"));
      counts[name] = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      counts[name] = 0;
    }
  }

  const binariesDir = path.join(backupDir, "fgEvidence-binaries");
  if (fs.existsSync(binariesDir)) {
    for (const file of fs.readdirSync(binariesDir)) {
      const rel = path.join("fgEvidence-binaries", file).replace(/\\/g, "/");
      sha256ByRelativePath[rel] = sha256(fs.readFileSync(path.join(binariesDir, file)));
    }
  }

  const manifest = buildBackupManifest({
    databaseName: args.database,
    counts,
    sha256ByRelativePath,
  });

  const outPath = path.join(backupDir, "MANIFEST.json");
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  console.log(
    JSON.stringify(
      redactReport({
        status: "MANIFEST_WRITTEN",
        databaseName: manifest.databaseName,
        artifactCount: Object.keys(sha256ByRelativePath).length,
        path: "MANIFEST.json",
      }),
      null,
      2,
    ),
  );
}

main();
