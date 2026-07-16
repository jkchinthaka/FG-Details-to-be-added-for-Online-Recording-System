#!/usr/bin/env node
/**
 * FG-DR-001 — isolated restore orchestration wrapper.
 *
 * SAFETY:
 *   - Requires ALLOW_ISOLATED_RESTORE_TEST=YES
 *   - Requires BACKUP_SOURCE_DATABASE_URL and RESTORE_TEST_DATABASE_URL
 *   - Rejects identical source/target and production fg_online target
 *   - Default mode is dry-run (prints plan only)
 *   - Destructive mongorestore only when --execute is passed AFTER validation
 *
 * Never prints connection strings.
 *
 * Usage:
 *   node scripts/disaster-recovery/restore-isolated.js
 *   node scripts/disaster-recovery/restore-isolated.js --execute --archive=/secure/backups/dump.archive
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const { validateIsolatedRestoreTarget } = require("./lib/restore-target-validator");
const { redactCredentials } = require("./lib/database-url");
const { buildRpoRtoRecord } = require("./lib/rpo-rto");
const { redactReport } = require("./lib/backup-manifest");

function parseArgs(argv) {
  const out = { execute: false, archive: null };
  for (const arg of argv) {
    if (arg === "--execute") out.execute = true;
    else if (arg.startsWith("--archive=")) out.archive = arg.slice(10);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const validation = validateIsolatedRestoreTarget(process.env);

  if (!validation.ok) {
    console.error(
      JSON.stringify(
        redactReport({
          status: "RESTORE_REFUSED",
          errors: validation.errors,
        }),
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const plan = {
    status: args.execute ? "RESTORE_EXECUTE" : "RESTORE_DRY_RUN",
    sourceDatabase: validation.sourceDatabase,
    targetDatabase: validation.targetDatabase,
    archive: args.archive ? path.basename(args.archive) : null,
    steps: [
      "1. Validate isolated target (done)",
      "2. Verify backup checksum / MANIFEST (operator)",
      "3. mongorestore --drop into RESTORE_TEST_DATABASE_URL only",
      "4. Run reconcile-all.js against restored target",
      "5. Record RPO/RTO timings",
    ],
  };

  if (!args.execute) {
    console.log(JSON.stringify(redactReport(plan), null, 2));
    console.log(
      JSON.stringify(
        buildRpoRtoRecord({
          status: "NOT_EXECUTED",
          notes: "Dry-run only — pass --execute with an isolated archive to perform restore",
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (!args.archive) {
    console.error(
      JSON.stringify({
        status: "RESTORE_REFUSED",
        errors: ["--archive=<path> is required with --execute"],
      }),
    );
    process.exit(1);
  }

  const mongorestore = spawnSync(
    "mongorestore",
    [
      `--uri=${process.env.RESTORE_TEST_DATABASE_URL}`,
      `--nsInclude=${validation.targetDatabase}.*`,
      "--drop",
      `--archive=${args.archive}`,
      "--gzip",
    ],
    { encoding: "utf8" },
  );

  if (mongorestore.error) {
    console.error(
      JSON.stringify(
        redactReport({
          status: "BLOCKED_EXTERNAL_RESTORE_TARGET",
          reason: redactCredentials(mongorestore.error.message),
          hint: "mongorestore not available or restore target unreachable",
        }),
        null,
        2,
      ),
    );
    process.exit(3);
  }

  if (mongorestore.status !== 0) {
    console.error(
      JSON.stringify(
        redactReport({
          status: "RESTORE_FAIL",
          exitCode: mongorestore.status,
          stderr: redactCredentials(mongorestore.stderr || "").slice(0, 500),
        }),
        null,
        2,
      ),
    );
    process.exit(2);
  }

  console.log(
    JSON.stringify(
      redactReport({
        status: "RESTORE_OK",
        targetDatabase: validation.targetDatabase,
        rpoRto: buildRpoRtoRecord({
          status: "PASS",
          restoreCompletedAt: new Date().toISOString(),
          notes: "mongorestore completed — run reconcile-all next",
        }),
      }),
      null,
      2,
    ),
  );
}

main();
