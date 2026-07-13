import {
  CHECKLIST_TEMPLATE_SEEDS,
  DAILY_CLEANING_TEMPLATE_SEED,
  FREEZER_TRUCK_TEMPLATE_SEED,
  MIN_SEED_PASSWORD_LENGTH,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  SEED_USER_DEFINITIONS,
  isValidSeedPassword,
  resolveAllSeedUsers,
  resolveSeedUser,
  totalSeedItemCount,
} from "./seed-data";

describe("seed-data", () => {
  describe("isValidSeedPassword", () => {
    it("rejects undefined", () => {
      expect(isValidSeedPassword(undefined)).toBe(false);
    });

    it("rejects passwords shorter than the minimum length", () => {
      expect(isValidSeedPassword("short")).toBe(false);
      expect(isValidSeedPassword("a".repeat(MIN_SEED_PASSWORD_LENGTH - 1))).toBe(false);
    });

    it("accepts passwords at or above the minimum length", () => {
      expect(isValidSeedPassword("a".repeat(MIN_SEED_PASSWORD_LENGTH))).toBe(true);
      expect(isValidSeedPassword("a-perfectly-fine-dev-password")).toBe(true);
    });
  });

  describe("resolveSeedUser", () => {
    const definition = SEED_USER_DEFINITIONS[0]!;

    it("returns null when email or password env vars are missing", () => {
      expect(resolveSeedUser(definition, {})).toBeNull();
      expect(resolveSeedUser(definition, { [definition.emailEnv]: "a@b.com" })).toBeNull();
      expect(resolveSeedUser(definition, { [definition.passwordEnv]: "password123" })).toBeNull();
    });

    it("throws when a password is present but too short", () => {
      expect(() =>
        resolveSeedUser(definition, {
          [definition.emailEnv]: "admin@example.local",
          [definition.passwordEnv]: "short",
        }),
      ).toThrow(/at least/);
    });

    it("resolves a user with defaults when only email + password are set", () => {
      const user = resolveSeedUser(definition, {
        [definition.emailEnv]: "admin@example.local",
        [definition.passwordEnv]: "a-valid-password",
      });

      expect(user).toEqual({
        employeeCode: `SEED-${definition.role}`,
        email: "admin@example.local",
        password: "a-valid-password",
        fullName: definition.defaultFullName,
        role: definition.role,
      });
    });

    it("honours overrides for employee code and full name", () => {
      const user = resolveSeedUser(definition, {
        [definition.emailEnv]: "admin@example.local",
        [definition.passwordEnv]: "a-valid-password",
        [definition.employeeCodeEnv]: "EMP-999",
        [definition.fullNameEnv]: "Custom Name",
      });

      expect(user?.employeeCode).toBe("EMP-999");
      expect(user?.fullName).toBe("Custom Name");
    });
  });

  describe("resolveAllSeedUsers", () => {
    it("returns an empty array when no seed env vars are configured", () => {
      expect(resolveAllSeedUsers({})).toEqual([]);
    });

    it("only resolves the users whose env vars are fully configured", () => {
      const [adminDefinition, operatorDefinition] = SEED_USER_DEFINITIONS as [
        (typeof SEED_USER_DEFINITIONS)[number],
        (typeof SEED_USER_DEFINITIONS)[number],
      ];
      const users = resolveAllSeedUsers({
        [adminDefinition.emailEnv]: "admin@example.local",
        [adminDefinition.passwordEnv]: "a-valid-password",
      });

      expect(users).toHaveLength(1);
      expect(users[0]?.role).toBe(adminDefinition.role);
      expect(operatorDefinition).toBeDefined();
    });
  });

  describe("ROLE_DEFINITIONS", () => {
    it("defines every role exactly once", () => {
      const names = ROLE_DEFINITIONS.map((role) => role.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("only references known permission keys", () => {
      for (const role of ROLE_DEFINITIONS) {
        for (const permission of role.permissions) {
          expect(PERMISSIONS).toContain(permission);
        }
      }
    });

    it("grants the System Administrator every permission", () => {
      const admin = ROLE_DEFINITIONS.find((role) => role.name === "SYSTEM_ADMINISTRATOR");
      expect(admin?.permissions).toHaveLength(PERMISSIONS.length);
    });
  });

  describe("checklist template seeds", () => {
    it("keeps the daily cleaning template in sync with @nelna/shared", () => {
      expect(totalSeedItemCount(DAILY_CLEANING_TEMPLATE_SEED)).toBeGreaterThan(0);
      expect(DAILY_CLEANING_TEMPLATE_SEED.code).toBe("NMS/PPU/CL/24");
    });

    it("keeps the freezer truck template in sync with @nelna/shared", () => {
      expect(totalSeedItemCount(FREEZER_TRUCK_TEMPLATE_SEED)).toBeGreaterThan(0);
      expect(FREEZER_TRUCK_TEMPLATE_SEED.code).toBe("NMS/PPU/CL/30");
    });

    it("declares each template with a unique code", () => {
      const codes = CHECKLIST_TEMPLATE_SEEDS.map((template) => template.code);
      expect(new Set(codes).size).toBe(codes.length);
    });
  });
});
