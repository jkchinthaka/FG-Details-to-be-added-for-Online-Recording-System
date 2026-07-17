#!/usr/bin/env node
/**
 * FG-DR-001 — verify a backup directory against MANIFEST.json (read-only).
 *
 * Usage:
 *   node scripts/disaster-recovery/verify-backup.js --dir=.local-backups/<folder>
 */
"use strict";

const path = require("path");
const { verifyBackupDirectory, redactReport } = require("./lib/backup-manifest");

function parseArgs(argv) {
  const out = { dir: null };
  for (const arg of argv) {
    if (arg.startsWith("--dir=")) out.dir = arg.slice(6);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) {
    console.error("Usage: --dir=<backupDir>");
    process.exit(1);
  }
  const result = verifyBackupDirectory(path.resolve(args.dir));
  console.log(
    JSON.stringify(
      redactReport({
        status: result.ok ? "BACKUP_VERIFY_PASS" : "BACKUP_VERIFY_FAIL",
        databaseName: result.manifest?.databaseName ?? null,
        errors: result.errors,
      }),
      null,
      2,
    ),
  );
  process.exit(result.ok ? 0 : 2);
}

main();
