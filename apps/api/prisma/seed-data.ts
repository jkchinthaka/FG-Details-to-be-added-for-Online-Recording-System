/**
 * Pure, side-effect-free seed data and helpers for prisma/seed.ts.
 *
 * Kept separate from seed.ts (which talks to the database) so this module can
 * be unit-tested without a Postgres connection.
 */
import {
  ALL_CLEANING_ITEMS,
  CHANGING_ROOM_CLEANING_ITEMS,
  DOCUMENT_CODES,
  FG_CLEANING_ITEMS,
  FREEZER_TRUCK_CHECK_ITEMS,
  USER_ROLES,
  USER_ROLE_LABELS,
  type UserRole,
} from "@nelna/shared";

// ---------------------------------------------------------------------------
// Permissions & roles
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  "users:manage",
  "roles:manage",
  "templates:manage",
  "templates:publish",
  "master_data:manage",
  "records:create",
  "records:read",
  "records:check",
  "records:verify",
  "corrective_actions:manage",
  "corrective_actions:read",
  "reports:read",
  "audit:read",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export type RoleSeedDefinition = {
  name: UserRole;
  description: string;
  isSystem: boolean;
  permissions: PermissionKey[];
};

/** Baseline role → permission mapping for the foundation phase. Fine-grained
 *  overrides are expected to be layered on top via the admin UI in later
 *  phases; this seed only establishes a sane, working default. */
export const ROLE_DEFINITIONS: RoleSeedDefinition[] = USER_ROLES.map((role) => ({
  name: role,
  description: USER_ROLE_LABELS[role],
  isSystem: true,
  permissions: rolePermissions(role),
}));

function rolePermissions(role: UserRole): PermissionKey[] {
  switch (role) {
    case "FG_OPERATOR":
      return ["records:create", "records:read"];
    case "FG_SUPERVISOR":
      return ["records:create", "records:read", "records:check", "corrective_actions:manage", "corrective_actions:read"];
    case "QA_EXECUTIVE":
      return ["records:read", "records:verify", "corrective_actions:manage", "corrective_actions:read", "reports:read"];
    case "FOOD_SAFETY_TEAM_LEADER":
      return [
        "records:read",
        "records:verify",
        "corrective_actions:manage",
        "corrective_actions:read",
        "reports:read",
        "templates:publish",
      ];
    case "SYSTEM_ADMINISTRATOR":
      return [...PERMISSIONS];
    case "AUDITOR":
      return ["records:read", "corrective_actions:read", "reports:read", "audit:read"];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export const DEPARTMENT_SEEDS = [
  {
    code: "FG",
    name: "Finished Goods",
    description: "Finished Goods handling, storage and dispatch",
    sections: [
      { code: "FG-STORE", name: "Finished Goods Store" },
      { code: "FG-CHANGE", name: "Changing Room" },
      { code: "FG-DISPATCH", name: "Dispatch / Loading Bay" },
    ],
  },
] as const;

export const SHIFT_SEEDS = [
  { code: "MORNING", name: "Morning", startTime: "06:00", endTime: "14:00" },
  { code: "AFTERNOON", name: "Afternoon", startTime: "14:00", endTime: "22:00" },
  { code: "NIGHT", name: "Night", startTime: "22:00", endTime: "06:00" },
] as const;

// ---------------------------------------------------------------------------
// Checklist templates
// ---------------------------------------------------------------------------

export type ChecklistItemSeed = {
  label: string;
  helpText?: string;
  allowNotApplicable?: boolean;
  requiresEvidenceOnFail?: boolean;
};

export type ChecklistSectionSeed = {
  name: string;
  items: ChecklistItemSeed[];
};

export type ChecklistTemplateSeed = {
  code: string;
  title: string;
  description: string;
  sections: ChecklistSectionSeed[];
};

/** NMS/PPU/CL/24 — Daily Cleaning Verification: Finished Goods + Changing Room. */
export const DAILY_CLEANING_TEMPLATE_SEED: ChecklistTemplateSeed = {
  code: DOCUMENT_CODES.DAILY_CLEANING,
  title: "Daily Cleaning Verification",
  description:
    "Daily verification of cleaning standards across the Finished Goods area and Changing Room.",
  sections: [
    {
      name: "Finished Goods",
      items: FG_CLEANING_ITEMS.map((item) => ({
        label: item.label,
        requiresEvidenceOnFail: true,
      })),
    },
    {
      name: "Changing Room",
      items: CHANGING_ROOM_CLEANING_ITEMS.map((item) => ({
        label: item.label,
        requiresEvidenceOnFail: true,
      })),
    },
  ],
};

/** NMS/PPU/CL/30 — Inspection of Freezer Truck Before Loading. */
export const FREEZER_TRUCK_TEMPLATE_SEED: ChecklistTemplateSeed = {
  code: DOCUMENT_CODES.FREEZER_TRUCK,
  title: "Inspection of Freezer Truck Before Loading",
  description: "Pre-loading inspection checklist for freezer trucks before Finished Goods loading.",
  sections: [
    {
      name: "Truck Check",
      items: FREEZER_TRUCK_CHECK_ITEMS.map((item) => ({
        label: item.label,
        requiresEvidenceOnFail: true,
      })),
    },
  ],
};

export const CHECKLIST_TEMPLATE_SEEDS: ChecklistTemplateSeed[] = [
  DAILY_CLEANING_TEMPLATE_SEED,
  FREEZER_TRUCK_TEMPLATE_SEED,
];

/** Sanity check used by both the seed script and its tests: every configured
 *  template must resolve back to the shared item catalogue exactly once. */
export function totalSeedItemCount(template: ChecklistTemplateSeed): number {
  return template.sections.reduce((sum, section) => sum + section.items.length, 0);
}

if (totalSeedItemCount(DAILY_CLEANING_TEMPLATE_SEED) !== ALL_CLEANING_ITEMS.length) {
  throw new Error("Daily cleaning template seed is out of sync with @nelna/shared cleaning items");
}

// ---------------------------------------------------------------------------
// Sample users — env controlled only, never hard-coded
// ---------------------------------------------------------------------------

export type SeedUserDefinition = {
  employeeCodeEnv: string;
  emailEnv: string;
  passwordEnv: string;
  fullNameEnv: string;
  defaultFullName: string;
  role: UserRole;
};

/** Every sample account is opt-in: it is only created when its email +
 *  password env vars are both present. Nothing here is a real credential. */
export const SEED_USER_DEFINITIONS: SeedUserDefinition[] = [
  {
    employeeCodeEnv: "SEED_ADMIN_EMPLOYEE_CODE",
    emailEnv: "SEED_ADMIN_EMAIL",
    passwordEnv: "SEED_ADMIN_PASSWORD",
    fullNameEnv: "SEED_ADMIN_FULL_NAME",
    defaultFullName: "System Administrator",
    role: "SYSTEM_ADMINISTRATOR",
  },
  {
    employeeCodeEnv: "SEED_OPERATOR_EMPLOYEE_CODE",
    emailEnv: "SEED_OPERATOR_EMAIL",
    passwordEnv: "SEED_OPERATOR_PASSWORD",
    fullNameEnv: "SEED_OPERATOR_FULL_NAME",
    defaultFullName: "FG Operator",
    role: "FG_OPERATOR",
  },
  {
    employeeCodeEnv: "SEED_QA_EMPLOYEE_CODE",
    emailEnv: "SEED_QA_EMAIL",
    passwordEnv: "SEED_QA_PASSWORD",
    fullNameEnv: "SEED_QA_FULL_NAME",
    defaultFullName: "QA Executive",
    role: "QA_EXECUTIVE",
  },
];

export type ResolvedSeedUser = {
  employeeCode: string;
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
};

export const MIN_SEED_PASSWORD_LENGTH = 8;

export function isValidSeedPassword(password: string | undefined): password is string {
  return typeof password === "string" && password.length >= MIN_SEED_PASSWORD_LENGTH;
}

/** Reads a single sample user's credentials from `env`. Returns `null` when
 *  the required email/password pair isn't configured — this is what keeps
 *  the seed idempotent and safe to run in environments with no seed users
 *  configured at all (e.g. CI). Throws only when a password is present but
 *  too weak, to fail fast instead of silently seeding a weak credential. */
export function resolveSeedUser(
  definition: SeedUserDefinition,
  env: Record<string, string | undefined>,
): ResolvedSeedUser | null {
  const email = env[definition.emailEnv];
  const password = env[definition.passwordEnv];

  if (!email || !password) {
    return null;
  }

  if (!isValidSeedPassword(password)) {
    throw new Error(
      `${definition.passwordEnv} must be at least ${MIN_SEED_PASSWORD_LENGTH} characters`,
    );
  }

  const employeeCode = env[definition.employeeCodeEnv] ?? defaultEmployeeCode(definition.role);

  return {
    employeeCode,
    email,
    password,
    fullName: env[definition.fullNameEnv] ?? definition.defaultFullName,
    role: definition.role,
  };
}

function defaultEmployeeCode(role: UserRole): string {
  return `SEED-${role}`;
}

export function resolveAllSeedUsers(
  env: Record<string, string | undefined>,
): ResolvedSeedUser[] {
  return SEED_USER_DEFINITIONS.map((definition) => resolveSeedUser(definition, env)).filter(
    (user): user is ResolvedSeedUser => user !== null,
  );
}
