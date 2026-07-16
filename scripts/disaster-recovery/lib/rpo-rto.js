/**
 * FG-DR-001 — RPO/RTO measurement record format.
 * Values remain NOT_EXECUTED until a real exercise fills them.
 */
"use strict";

/**
 * @param {Partial<{
 *   exerciseId: string,
 *   operator: string,
 *   backupCompletedAt: string | null,
 *   incidentDetectedAt: string | null,
 *   restoreStartedAt: string | null,
 *   restoreCompletedAt: string | null,
 *   reconciliationCompletedAt: string | null,
 *   appSmokeCompletedAt: string | null,
 *   lastSuccessfulBackupAt: string | null,
 *   dataLossWindowMinutes: number | null,
 *   notes: string,
 *   status: 'NOT_EXECUTED' | 'PASS' | 'FAIL' | 'BLOCKED_EXTERNAL_RESTORE_TARGET',
 * }>} partial
 */
function buildRpoRtoRecord(partial = {}) {
  const status = partial.status ?? "NOT_EXECUTED";
  const backupCompletedAt = partial.backupCompletedAt ?? null;
  const incidentDetectedAt = partial.incidentDetectedAt ?? null;
  const restoreStartedAt = partial.restoreStartedAt ?? null;
  const restoreCompletedAt = partial.restoreCompletedAt ?? null;
  const reconciliationCompletedAt = partial.reconciliationCompletedAt ?? null;
  const appSmokeCompletedAt = partial.appSmokeCompletedAt ?? null;
  const lastSuccessfulBackupAt = partial.lastSuccessfulBackupAt ?? null;

  /** @type {number | null} */
  let measuredRpoMinutes = null;
  if (incidentDetectedAt && lastSuccessfulBackupAt) {
    measuredRpoMinutes = Math.max(
      0,
      Math.round(
        (Date.parse(incidentDetectedAt) - Date.parse(lastSuccessfulBackupAt)) / 60_000,
      ),
    );
  } else if (typeof partial.dataLossWindowMinutes === "number") {
    measuredRpoMinutes = partial.dataLossWindowMinutes;
  }

  /** @type {number | null} */
  let measuredRtoMinutes = null;
  const rtoEnd = appSmokeCompletedAt || reconciliationCompletedAt || restoreCompletedAt;
  if (restoreStartedAt && rtoEnd) {
    measuredRtoMinutes = Math.max(
      0,
      Math.round((Date.parse(rtoEnd) - Date.parse(restoreStartedAt)) / 60_000),
    );
  }

  return {
    schemaVersion: 1,
    exerciseId: partial.exerciseId ?? null,
    operator: partial.operator ?? null,
    status,
    targets: {
      rpoMinutes: 24 * 60,
      rtoMinutes: 4 * 60,
      note: "Planning targets pending IT Manager adoption — not contractual SLAs",
    },
    timestamps: {
      backupCompletedAt,
      lastSuccessfulBackupAt,
      incidentDetectedAt,
      restoreStartedAt,
      restoreCompletedAt,
      reconciliationCompletedAt,
      appSmokeCompletedAt,
    },
    measured: {
      rpoMinutes: status === "NOT_EXECUTED" ? null : measuredRpoMinutes,
      rtoMinutes: status === "NOT_EXECUTED" ? null : measuredRtoMinutes,
    },
    notes: partial.notes ?? "",
  };
}

module.exports = { buildRpoRtoRecord };
