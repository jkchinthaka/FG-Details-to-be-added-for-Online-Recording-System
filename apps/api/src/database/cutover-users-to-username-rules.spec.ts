import {
  buildCutoverPlan,
  detectCutoverConflicts,
  isReplacementAdmin,
  parseCutoverMode,
  verifyCutoverInvariants,
} from "./cutover-users-to-username-rules";

describe("cutover-users-to-username-rules", () => {
  const admin = {
    username: "sys.admin",
    password: "a-secure-password-12",
    employeeCode: "EMP-ADMIN-NEW",
    fullName: "System Administrator",
  };

  it("defaults to dry-run", () => {
    expect(parseCutoverMode([])).toBe("dry-run");
    expect(parseCutoverMode(["--execute"])).toBe("execute");
  });

  it("never archives the replacement administrator", () => {
    const users = [
      {
        id: "admin",
        employeeCode: "EMP-ADMIN-NEW",
        username: "sys.admin",
        email: null,
        status: "ACTIVE",
      },
      {
        id: "op",
        employeeCode: "EMP-OPERATOR-001",
        username: null,
        email: "op@example.local",
        status: "ACTIVE",
      },
    ];

    expect(isReplacementAdmin(users[0]!, admin)).toBe(true);
    const plan = buildCutoverPlan({ users, admin });
    expect(plan.some((p) => p.userId === "admin" && p.action === "skip-admin")).toBe(
      true,
    );
    expect(plan.some((p) => p.userId === "op" && p.action === "archive")).toBe(true);
  });

  it("detects duplicate usernames and missing admin role", () => {
    const conflicts = detectCutoverConflicts({
      hasAdminRole: false,
      admin,
      users: [
        {
          id: "1",
          employeeCode: "A",
          username: "same.user",
          email: null,
          status: "ACTIVE",
        },
        {
          id: "2",
          employeeCode: "B",
          username: "Same.User",
          email: null,
          status: "ACTIVE",
        },
      ],
    });
    expect(conflicts.some((c) => c.code === "MISSING_ADMIN_ROLE")).toBe(true);
    expect(conflicts.some((c) => c.code === "DUPLICATE_USERNAME")).toBe(true);
  });

  it("verifies replacement admin remains ACTIVE and never treated as legacy", () => {
    const failures = verifyCutoverInvariants({
      adminEmployeeCode: "EMP-ADMIN-NEW",
      adminUsername: "sys.admin",
      users: [
        {
          id: "admin",
          employeeCode: "EMP-ADMIN-NEW",
          username: "sys.admin",
          status: "ACTIVE",
          roles: ["SYSTEM_ADMINISTRATOR"],
        },
        {
          id: "op",
          employeeCode: "EMP-OPERATOR-001",
          username: "archived-emp-operator-001",
          status: "INACTIVE",
          roles: ["FG_OPERATOR"],
        },
      ],
    });
    expect(failures).toEqual([]);
  });

  it("fails when replacement admin would be INACTIVE", () => {
    const failures = verifyCutoverInvariants({
      adminEmployeeCode: "EMP-ADMIN-NEW",
      adminUsername: "sys.admin",
      users: [
        {
          id: "admin",
          employeeCode: "EMP-ADMIN-NEW",
          username: "sys.admin",
          status: "INACTIVE",
          roles: ["SYSTEM_ADMINISTRATOR"],
        },
      ],
    });
    expect(failures.some((f) => /not ACTIVE/.test(f))).toBe(true);
  });
});
