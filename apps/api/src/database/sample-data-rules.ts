/**
 * Pure classification helpers for sample-data cleanup (unit-tested).
 */
export const CONFIRMED_SAMPLE_EMAILS = [
  "admin@example.local",
  "operator@example.local",
  "qa@example.local",
  "supervisor@example.local",
] as const;

export const CONFIRMED_SAMPLE_EMPLOYEE_CODES = [
  "EMP-ADMIN-001",
  "EMP-OPERATOR-001",
  "EMP-QA-001",
  "EMP-SUPERVISOR-001",
] as const;

export const CONFIRMED_SAMPLE_VEHICLE_NUMBERS = [
  "WP CAB-1234",
  "WP CAC-5678",
  "WP KL-9012",
] as const;

export type SampleUserLike = {
  email?: string | null;
  employeeCode?: string | null;
};

export function isConfirmedSampleUser(user: SampleUserLike): boolean {
  const email = String(user.email || "").toLowerCase();
  const code = String(user.employeeCode || "");
  if (
    (CONFIRMED_SAMPLE_EMAILS as readonly string[]).includes(email) ||
    (CONFIRMED_SAMPLE_EMPLOYEE_CODES as readonly string[]).includes(code)
  ) {
    return true;
  }
  const demoSuffixes = [
    "@example.local",
    "@test.local",
    "@demo.local",
    "@test.nelna.local",
  ];
  if (
    demoSuffixes.some((suffix) => email.endsWith(suffix)) &&
    /^(EMP-|SEED-|TST-)/.test(code)
  ) {
    return true;
  }
  return false;
}

export function assertDatabaseIsFgOnline(databaseName: string | null | undefined): void {
  if (databaseName !== "fg_online") {
    throw new Error(`Refuse: database must be fg_online (got ${databaseName ?? "none"})`);
  }
}

export function parseCleanupMode(argv: string[]): "dry-run" | "execute" {
  if (argv.includes("--execute")) return "execute";
  return "dry-run";
}

export function demoSeedAllowed(env: { NODE_ENV?: string; ENABLE_DEMO_SEED?: string }): {
  allowed: boolean;
  reason: string;
} {
  if (env.ENABLE_DEMO_SEED !== "true") {
    return { allowed: false, reason: "ENABLE_DEMO_SEED not true" };
  }
  if (env.NODE_ENV === "production") {
    return { allowed: false, reason: "blocked in production" };
  }
  return { allowed: true, reason: "ok" };
}
