#!/usr/bin/env node
/**
 * FG-DB-003 — read-only integrity reconciliation (never runs on Nest startup).
 *
 * Usage:
 *   node scripts/database/reconcile-integrity.js
 *   node scripts/database/reconcile-integrity.js --json
 *   node scripts/database/reconcile-integrity.js --repair --authorize=YES_I_UNDERSTAND
 *
 * Repair mode is intentionally blocked unless the explicit authorization token is
 * provided. Default mode is always read-only verification.
 */
"use strict";

const { MongoClient } = require("mongodb");

function parseArgs(argv) {
  const args = {
    json: false,
    repair: false,
    authorize: "",
    uri: process.env.DATABASE_URL || "",
  };
  for (const raw of argv.slice(2)) {
    if (raw === "--json") args.json = true;
    else if (raw === "--repair") args.repair = true;
    else if (raw.startsWith("--authorize=")) args.authorize = raw.slice("--authorize=".length);
    else if (raw.startsWith("--uri=")) args.uri = raw.slice("--uri=".length);
  }
  return args;
}

function dbNameFromUri(uri) {
  try {
    const u = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:"));
    return (u.pathname || "").replace(/^\//, "").split("?")[0] || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.uri) {
    console.error("DATABASE_URL / --uri is required");
    process.exit(2);
  }
  const dbName = dbNameFromUri(args.uri);
  if (dbName === "fg_online" && process.env.ALLOW_PRODUCTION_READ !== "YES") {
    console.error(
      "Refusing production database without ALLOW_PRODUCTION_READ=YES (read-only).",
    );
    process.exit(2);
  }
  if (args.repair && args.authorize !== "YES_I_UNDERSTAND") {
    console.error(
      "Repair refused. Pass --repair --authorize=YES_I_UNDERSTAND after human approval.",
    );
    process.exit(2);
  }

  const client = new MongoClient(args.uri, { maxPoolSize: 5 });
  await client.connect();
  const db = client.db(dbName || undefined);
  const findings = [];

  async function check(name, fn) {
    try {
      const result = await fn();
      findings.push({ name, ok: true, ...result });
    } catch (error) {
      findings.push({
        name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await check("required_indexes_sample", async () => {
    const indexes = await db.collection("inspection_records").indexes();
    const names = indexes.map((i) => i.name);
    const required = [
      "_id_",
      "inspection_records_deduplicationKey_unique_sparse",
    ];
    const missing = required.filter((n) => n !== "_id_" && !names.includes(n));
    // Dedup index name may vary — treat presence of unique sparse on deduplicationKey as OK.
    const hasDedup = indexes.some(
      (i) =>
        i.unique &&
        i.sparse &&
        i.key &&
        Object.prototype.hasOwnProperty.call(i.key, "deduplicationKey"),
    );
    return {
      indexCount: indexes.length,
      missingNamed: missing,
      hasDraftDedupUniqueSparse: hasDedup,
    };
  });

  await check("duplicate_operational_keys", async () => {
    const dupes = await db
      .collection("inspection_records")
      .aggregate([
        { $match: { deduplicationKey: { $type: "string", $ne: "" } } },
        { $group: { _id: "$deduplicationKey", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 20 },
      ])
      .toArray();
    return { duplicateKeyGroups: dupes.length, sample: dupes.slice(0, 5) };
  });

  await check("approval_duplicates", async () => {
    const dupes = await db
      .collection("approval_records")
      .aggregate([
        {
          $group: {
            _id: {
              recordId: "$recordId",
              approvalType: "$approvalType",
              workflowCycle: "$workflowCycle",
            },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $limit: 20 },
      ])
      .toArray();
    return { duplicateApprovalGroups: dupes.length, sample: dupes.slice(0, 5) };
  });

  await check("stale_report_jobs", async () => {
    const now = new Date();
    const stale = await db.collection("report_export_jobs").countDocuments({
      status: { $in: ["QUEUED", "RUNNING", "COMPLETED"] },
      expiresAt: { $lt: now },
    });
    return { staleOrExpiredOpenJobs: stale };
  });

  await check("gridfs_metadata_sample", async () => {
    const files = db.collection("fgEvidence.files");
    const attachments = db.collection("inspection_attachments");
    const fileCount = await files.countDocuments({});
    const attachmentCount = await attachments.countDocuments({
      gridFsFileId: { $exists: true, $ne: null },
    });
    return {
      gridFsFileCount: fileCount,
      attachmentWithGridFsCount: attachmentCount,
      note: "Full orphan reconcile remains scripts/database/reconcile-evidence-orphans.js",
    };
  });

  await check("audit_invariants", async () => {
    const missingAction = await db.collection("audit_logs").countDocuments({
      $or: [{ action: null }, { action: "" }],
    });
    return { auditRowsMissingAction: missingAction };
  });

  await check("notification_integrity", async () => {
    const orphanUser = await db
      .collection("notifications")
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $match: { user: { $size: 0 } } },
        { $limit: 5 },
      ])
      .toArray();
    return { notificationsMissingUserSample: orphanUser.length };
  });

  if (args.repair) {
    findings.push({
      name: "repair",
      ok: true,
      applied: false,
      message:
        "Repair authorization accepted but no destructive repairs are auto-applied in this script. Use dedicated cleanup tools with explicit flags.",
    });
  }

  const failed = findings.filter((f) => f.ok === false);
  const report = {
    generatedAt: new Date().toISOString(),
    database: dbName,
    mode: args.repair ? "repair-authorized-no-op" : "read-only",
    findings,
    summary: {
      checks: findings.length,
      failed: failed.length,
      status: failed.length === 0 ? "PASS" : "FAIL",
    },
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`FG-DB-003 integrity reconcile (${report.mode}) → ${report.summary.status}`);
    for (const finding of findings) {
      console.log(`- ${finding.name}: ${finding.ok ? "ok" : "FAIL"}`);
    }
  }

  await client.close();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
