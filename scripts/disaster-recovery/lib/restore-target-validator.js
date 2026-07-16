/**
 * FG-DR-001 — isolated restore target validator.
 * Read-only by default; destructive restore must pass explicit allow flag.
 */
"use strict";

const {
  databaseNameFromUrl,
  isAllowedRestoreTargetName,
  isMalformedDatabaseName,
  isProductionDatabaseName,
  redactCredentials,
} = require("./database-url");

/**
 * @typedef {object} RestoreEnv
 * @property {string | undefined} ALLOW_ISOLATED_RESTORE_TEST
 * @property {string | undefined} BACKUP_SOURCE_DATABASE_URL
 * @property {string | undefined} RESTORE_TEST_DATABASE_URL
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {string | null} sourceDatabase
 * @property {string | null} targetDatabase
 * @property {string} summary
 */

/**
 * Validate restore exercise environment. Never echoes raw URLs.
 * @param {RestoreEnv} env
 * @returns {ValidationResult}
 */
function validateIsolatedRestoreTarget(env) {
  const errors = [];
  const allow = (env.ALLOW_ISOLATED_RESTORE_TEST || "").trim();
  const sourceUrl = env.BACKUP_SOURCE_DATABASE_URL;
  const targetUrl = env.RESTORE_TEST_DATABASE_URL;

  if (allow !== "YES") {
    errors.push("ALLOW_ISOLATED_RESTORE_TEST must be exactly YES");
  }
  if (!sourceUrl) {
    errors.push("BACKUP_SOURCE_DATABASE_URL is required");
  }
  if (!targetUrl) {
    errors.push("RESTORE_TEST_DATABASE_URL is required");
  }

  const sourceDatabase = databaseNameFromUrl(sourceUrl);
  const targetDatabase = databaseNameFromUrl(targetUrl);

  if (sourceUrl && isMalformedDatabaseName(sourceDatabase)) {
    errors.push("BACKUP_SOURCE_DATABASE_URL has a malformed database name");
  }
  if (targetUrl && isMalformedDatabaseName(targetDatabase)) {
    errors.push("RESTORE_TEST_DATABASE_URL has a malformed database name");
  }

  if (sourceUrl && targetUrl && sourceUrl === targetUrl) {
    errors.push("source and target connection strings must not be identical");
  }
  if (
    sourceDatabase &&
    targetDatabase &&
    sourceDatabase === targetDatabase &&
    !errors.some((e) => e.includes("identical"))
  ) {
    errors.push("source and target database names must not be identical");
  }

  if (targetDatabase && isProductionDatabaseName(targetDatabase)) {
    errors.push("RESTORE_TEST_DATABASE_URL must not target production fg_online");
  }
  if (targetDatabase && !isAllowedRestoreTargetName(targetDatabase)) {
    errors.push(
      `RESTORE_TEST_DATABASE_URL database "${targetDatabase}" is not an allowed isolated restore target`,
    );
  }

  const ok = errors.length === 0;
  return {
    ok,
    errors,
    sourceDatabase,
    targetDatabase,
    summary: ok
      ? `isolated restore allowed: ${sourceDatabase} → ${targetDatabase}`
      : redactCredentials(errors.join("; ")),
  };
}

module.exports = {
  validateIsolatedRestoreTarget,
};
