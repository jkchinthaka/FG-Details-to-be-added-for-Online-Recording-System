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
  PERMISSIONS,
  USER_ROLES,
  USER_ROLE_LABELS,
  detectWorkShiftForHour,
  type ChecklistItemType,
  type PermissionKey,
  type UserRole,
  type WorkShift,
} from "@nelna/shared";

// ---------------------------------------------------------------------------
// Permissions & roles
// ---------------------------------------------------------------------------

// Canonical permission keys now live in @nelna/shared (see permissions.ts) so
// the API's auth guards and this seed can never drift apart. Re-exported here
// so existing imports of `PERMISSIONS`/`PermissionKey` from this module keep
// working unchanged.
export { PERMISSIONS };
export type { PermissionKey };

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
      return [
        "records:create",
        "records:read",
        "records:check",
        "records:return",
        "corrective_actions:manage",
        "corrective_actions:read",
        "reports:read",
        "loading_decisions:approve",
        "vehicles:manual_entry",
      ];
    case "QA_EXECUTIVE":
      return [
        "records:read",
        "records:verify",
        "records:return",
        "records:reject",
        "corrective_actions:manage",
        "corrective_actions:read",
        "reports:read",
        "loading_decisions:approve",
        "vehicles:manual_entry",
      ];
    case "FOOD_SAFETY_TEAM_LEADER":
      return [
        "records:read",
        "records:verify",
        "records:return",
        "records:reject",
        "records:void",
        "records:amend",
        "corrective_actions:manage",
        "corrective_actions:read",
        "reports:read",
        "templates:publish",
        "loading_decisions:approve",
        "vehicles:manual_entry",
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
// Fleet master data — transporters, vehicles, drivers
// ---------------------------------------------------------------------------

export const TRANSPORTER_SEEDS = [
  { name: "Lanka Cold Logistics", contactPhone: "+94 11 234 5678" },
  { name: "Nelna Fleet Services", contactPhone: "+94 11 876 5432" },
] as const;

export type VehicleSeed = {
  vehicleNumber: string;
  freezerTruckNumber: string;
  transporterName: string;
};

/** Sample freezer trucks that make the vehicle search/selector usable out
 *  of the box in a fresh dev environment. */
export const VEHICLE_SEEDS: VehicleSeed[] = [
  {
    vehicleNumber: "WP CAB-1234",
    freezerTruckNumber: "FT-01",
    transporterName: "Lanka Cold Logistics",
  },
  {
    vehicleNumber: "WP CAC-5678",
    freezerTruckNumber: "FT-02",
    transporterName: "Lanka Cold Logistics",
  },
  {
    vehicleNumber: "WP KL-9012",
    freezerTruckNumber: "FT-03",
    transporterName: "Nelna Fleet Services",
  },
];

export type DriverSeed = {
  fullName: string;
  licenseNumber: string;
  transporterName: string;
};

export const DRIVER_SEEDS: DriverSeed[] = [
  {
    fullName: "Sunil Perera",
    licenseNumber: "B1234567",
    transporterName: "Lanka Cold Logistics",
  },
  {
    fullName: "Kamal Silva",
    licenseNumber: "B7654321",
    transporterName: "Nelna Fleet Services",
  },
];

// ---------------------------------------------------------------------------
// Checklist templates
// ---------------------------------------------------------------------------

export type ChecklistItemSeed = {
  label: string;
  helpText?: string;
  itemType?: ChecklistItemType;
  allowNotApplicable?: boolean;
  requiresEvidenceOnFail?: boolean;
  isCriticalFailure?: boolean;
  remarkRequiredOnFail?: boolean;
  correctiveActionRequiredOnFail?: boolean;
  minValue?: number;
  maxValue?: number;
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
        itemType: "ACCEPTABLE_UNACCEPTABLE_NA" as ChecklistItemType,
        requiresEvidenceOnFail: true,
        remarkRequiredOnFail: true,
        // Cold storage failures directly risk product safety — always critical.
        isCriticalFailure: item.id === "fg_cold_room_1" || item.id === "fg_cold_room_2",
        correctiveActionRequiredOnFail:
          item.id === "fg_cold_room_1" || item.id === "fg_cold_room_2",
      })),
    },
    {
      name: "Changing Room",
      items: CHANGING_ROOM_CLEANING_ITEMS.map((item) => ({
        label: item.label,
        itemType: "ACCEPTABLE_UNACCEPTABLE_NA" as ChecklistItemType,
        requiresEvidenceOnFail: true,
        remarkRequiredOnFail: true,
      })),
    },
  ],
};

/** Checkpoints whose failure directly compromises product safety in
 *  transit — always a critical failure that automatically blocks loading
 *  and can never be operator- or supervisor-overridden to "approved". */
const FREEZER_TRUCK_CRITICAL_ITEM_IDS: readonly string[] = [
  "door_lock",
  "sealing",
  "freezer_unit_operational",
  "insects_presence",
  "insect_signs",
  "contamination_evidence",
];

/** NMS/PPU/CL/30 — Inspection of Freezer Truck Before Loading. */
export const FREEZER_TRUCK_TEMPLATE_SEED: ChecklistTemplateSeed = {
  code: DOCUMENT_CODES.FREEZER_TRUCK,
  title: "Inspection of Freezer Truck Before Loading",
  description:
    "Pre-loading inspection checklist for freezer trucks before Finished Goods loading.",
  sections: [
    {
      name: "Truck Check",
      items: FREEZER_TRUCK_CHECK_ITEMS.map((item) => {
        const isCritical = FREEZER_TRUCK_CRITICAL_ITEM_IDS.includes(item.id);
        return {
          label: item.label,
          itemType: "PASS_FAIL_NA" as ChecklistItemType,
          requiresEvidenceOnFail: true,
          remarkRequiredOnFail: true,
          isCriticalFailure: isCritical,
          correctiveActionRequiredOnFail: isCritical,
        };
      }),
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
  throw new Error(
    "Daily cleaning template seed is out of sync with @nelna/shared cleaning items",
  );
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

  const employeeCode =
    env[definition.employeeCodeEnv] ?? defaultEmployeeCode(definition.role);

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
  return SEED_USER_DEFINITIONS.map((definition) =>
    resolveSeedUser(definition, env),
  ).filter((user): user is ResolvedSeedUser => user !== null);
}

// ---------------------------------------------------------------------------
// Today's Tasks — sample TaskAssignment rows for the seeded FG Operator
// ---------------------------------------------------------------------------

export type TaskAssignmentSeed = {
  templateCode: string;
  areaLabel: string;
  shiftCode: WorkShift;
  dueDate: Date;
};

/** Midnight UTC for `now`'s calendar date — matches how `dueDate` (a Prisma
 *  `@db.Date` column) is compared against in the tasks service, so seeding
 *  and reading always agree on what counts as "today". */
export function todayAtMidnightUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The FG Operator's sample "Today's Tasks": one Daily Cleaning Verification
 * assignment and one Freezer Truck Inspection assignment, due today, for
 * whichever shift the seed is run during. Pure and deterministic given
 * `now`, so it's fully unit-testable without a database.
 */
export function buildTodaysTaskAssignmentSeeds(now: Date): TaskAssignmentSeed[] {
  const dueDate = todayAtMidnightUtc(now);
  // UTC hour (not local) — the seed script runs server-side and must produce
  // the same result in any timezone/CI environment given the same instant.
  const shiftCode = detectWorkShiftForHour(now.getUTCHours());

  return [
    {
      templateCode: DOCUMENT_CODES.DAILY_CLEANING,
      areaLabel: "Finished Goods + Changing Room",
      shiftCode,
      dueDate,
    },
    {
      templateCode: DOCUMENT_CODES.FREEZER_TRUCK,
      areaLabel: "Dispatch / Loading Bay",
      shiftCode,
      dueDate,
    },
  ];
}
