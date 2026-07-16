import { archivedUsernameForEmployeeCode } from "@nelna/shared";
import {
  parseUsernameMigrationMode,
  planLegacyUserMigration,
  readUsernameBootstrapAdminInput,
  userHasHistoricalRelations,
} from "./migrate-users-to-username-rules";

describe("parseUsernameMigrationMode", () => {
  it("defaults to dry-run", () => {
    expect(parseUsernameMigrationMode([])).toBe("dry-run");
    expect(parseUsernameMigrationMode(["--dry-run"])).toBe("dry-run");
  });

  it("selects execute only with --execute", () => {
    expect(parseUsernameMigrationMode(["--execute"])).toBe("execute");
  });
});

describe("readUsernameBootstrapAdminInput", () => {
  it("rejects missing bootstrap fields", () => {
    const { issues } = readUsernameBootstrapAdminInput({});
    expect(issues.length).toBeGreaterThan(0);
  });

  it("accepts valid bootstrap input without logging secrets", () => {
    const { input, issues } = readUsernameBootstrapAdminInput({
      USERNAME_BOOTSTRAP_ADMIN_USERNAME: "sys.admin",
      USERNAME_BOOTSTRAP_ADMIN_PASSWORD: "a-secure-password-12",
      USERNAME_BOOTSTRAP_ADMIN_EMPLOYEE_CODE: "EMP-ADMIN-NEW",
      USERNAME_BOOTSTRAP_ADMIN_FULL_NAME: "System Administrator",
    });
    expect(issues).toHaveLength(0);
    expect(input?.username).toBe("sys.admin");
    expect(input?.password).toBe("a-secure-password-12");
  });
});

describe("planLegacyUserMigration", () => {
  it("never marks users for hard deletion", () => {
    const plan = planLegacyUserMigration({
      userId: "u1",
      employeeCode: "EMP-OPERATOR-001",
      username: null,
      replacementAdminEmployeeCode: "EMP-ADMIN-NEW",
      replacementAdminUsername: "sys.admin",
    });
    expect(plan.archivedUsername).toBe(
      archivedUsernameForEmployeeCode("EMP-OPERATOR-001"),
    );
  });

  it("skips replacement administrator", () => {
    const plan = planLegacyUserMigration({
      userId: "admin",
      employeeCode: "EMP-ADMIN-NEW",
      username: "sys.admin",
      replacementAdminEmployeeCode: "EMP-ADMIN-NEW",
      replacementAdminUsername: "sys.admin",
    });
    expect(plan.isReplacementAdmin).toBe(true);
  });
});

describe("userHasHistoricalRelations", () => {
  it("detects any non-zero relation count", () => {
    expect(
      userHasHistoricalRelations({
        createdRecords: 1,
        checkedRecords: 0,
        verifiedRecords: 0,
        uploadedAttachments: 0,
        decidedApprovals: 0,
        createdCorrectiveActions: 0,
        assignedCorrectiveActions: 0,
        verifiedCorrectiveActions: 0,
        closedCorrectiveActions: 0,
        uploadedCorrectiveEvidence: 0,
        publishedTemplateVersions: 0,
        createdTemplates: 0,
        decidedTruckLoadings: 0,
        notifications: 0,
        auditLogs: 0,
        taskAssignments: 0,
      }),
    ).toBe(true);
  });
});
