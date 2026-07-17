/**
 * FG-DR-001 — safe URL helpers for MongoDB disaster recovery tooling.
 * Never log or return full connection strings with credentials.
 */
"use strict";

const PRODUCTION_DATABASE_NAMES = new Set(["fg_online"]);

/** Isolated restore targets only — never production. */
const ALLOWED_RESTORE_TARGET_PATTERN =
  /^(fg_online_test|fg_online_restore_test|fg_online_uat|fg_dr_restore(?:_[a-z0-9]+)?)$/;

const MALFORMED_NAME = /[^a-zA-Z0-9_]/;

/**
 * @param {string | undefined | null} url
 * @returns {string | null}
 */
function databaseNameFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    // Prefer URL parsing when possible (handles srv + query).
    const normalized = trimmed.replace(/^mongodb(\+srv)?:\/\//, "http://");
    const parsed = new URL(normalized);
    const name = parsed.pathname.replace(/^\//, "").split("/")[0];
    return name || null;
  } catch {
    const match = trimmed.match(/\/([^/?]+)(?:\?|$)/);
    return match?.[1] ?? null;
  }
}

/**
 * @param {string | undefined | null} message
 * @returns {string}
 */
function redactCredentials(message) {
  return String(message ?? "").replace(/\/\/[^/\s@]*:[^/\s@]*@/g, "//****:****@");
}

/**
 * @param {string | null} name
 * @returns {boolean}
 */
function isProductionDatabaseName(name) {
  return Boolean(name && PRODUCTION_DATABASE_NAMES.has(name));
}

/**
 * @param {string | null} name
 * @returns {boolean}
 */
function isAllowedRestoreTargetName(name) {
  if (!name || MALFORMED_NAME.test(name)) return false;
  if (isProductionDatabaseName(name)) return false;
  return ALLOWED_RESTORE_TARGET_PATTERN.test(name);
}

/**
 * @param {string | null} name
 * @returns {boolean}
 */
function isMalformedDatabaseName(name) {
  if (!name || name.length < 2) return true;
  return MALFORMED_NAME.test(name);
}

module.exports = {
  PRODUCTION_DATABASE_NAMES,
  ALLOWED_RESTORE_TARGET_PATTERN,
  databaseNameFromUrl,
  redactCredentials,
  isProductionDatabaseName,
  isAllowedRestoreTargetName,
  isMalformedDatabaseName,
};
