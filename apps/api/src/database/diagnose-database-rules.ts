/**
 * Pure helpers for database connectivity diagnostics.
 * Never log or return credentials, userinfo, or full DATABASE_URL.
 */
import {
  extractMongoDatabaseName,
  isMongoConnectionUrl,
} from "../config/validate-production-env";

export const PRODUCTION_DB_NAME = "fg_online";

export type DiagnoseDatabaseSummary = {
  provider: "mongodb";
  usesSrv: boolean;
  databaseName: string | null;
  isProductionDatabase: boolean;
};

/** Redact credentials and host-like segments from error text for safe logging. */
export function redactDatabaseErrorMessage(message: string): string {
  return message
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, "mongodb://[redacted]")
    .replace(/[a-z0-9._%+-]+:[^@\s]+@/gi, "[redacted-userinfo]@")
    .replace(/password[=:]\S+/gi, "password=[redacted]")
    .replace(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, "[redacted-hash]")
    .replace(/\b[a-z0-9-]+\.mongodb\.net\b/gi, "[redacted-host]");
}

export function summarizeDatabaseUrl(
  databaseUrl: string | undefined,
): DiagnoseDatabaseSummary {
  const trimmed = (databaseUrl ?? "").trim();
  if (!trimmed) {
    throw new Error("DATABASE_URL is required");
  }
  if (!isMongoConnectionUrl(trimmed)) {
    throw new Error("DATABASE_URL must be a MongoDB connection string");
  }
  const databaseName = extractMongoDatabaseName(trimmed);
  return {
    provider: "mongodb",
    usesSrv: /^mongodb\+srv:\/\//i.test(trimmed),
    databaseName,
    isProductionDatabase: databaseName === PRODUCTION_DB_NAME,
  };
}

export function assertProductionDatabaseName(
  databaseName: string | null | undefined,
): void {
  if (databaseName !== PRODUCTION_DB_NAME) {
    throw new Error(
      `Refuse: database must be ${PRODUCTION_DB_NAME} (got ${databaseName ?? "none"})`,
    );
  }
}
