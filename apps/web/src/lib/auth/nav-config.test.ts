import { describe, expect, it } from "vitest";
import { filterNavItemsByRole, isNavItemVisible } from "./nav-config";

const ALL_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/tasks", label: "My Tasks" },
  { href: "/records/new", label: "New Record" },
  { href: "/records", label: "Records" },
  { href: "/corrective-actions", label: "Corrective Actions" },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Administration" },
  { href: "/profile", label: "Profile" },
];

describe("isNavItemVisible", () => {
  it("shows role-agnostic destinations to every authenticated role", () => {
    expect(isNavItemVisible("/", ["AUDITOR"])).toBe(true);
    expect(isNavItemVisible("/profile", ["SYSTEM_ADMINISTRATOR"])).toBe(true);
  });

  it("shows the universal Today's Tasks dashboard ('/tasks') to every authenticated role", () => {
    for (const role of [
      "FG_OPERATOR",
      "FG_SUPERVISOR",
      "QA_EXECUTIVE",
      "FOOD_SAFETY_TEAM_LEADER",
      "SYSTEM_ADMINISTRATOR",
      "AUDITOR",
    ] as const) {
      expect(isNavItemVisible("/tasks", [role])).toBe(true);
    }
  });

  it("shows the FG Operator today's tasks, new records and their records", () => {
    expect(isNavItemVisible("/tasks", ["FG_OPERATOR"])).toBe(true);
    expect(isNavItemVisible("/records/new", ["FG_OPERATOR"])).toBe(true);
    expect(isNavItemVisible("/records", ["FG_OPERATOR"])).toBe(true);
  });

  it("hides Administration from every non-admin role", () => {
    for (const role of [
      "FG_OPERATOR",
      "FG_SUPERVISOR",
      "QA_EXECUTIVE",
      "FOOD_SAFETY_TEAM_LEADER",
      "AUDITOR",
    ] as const) {
      expect(isNavItemVisible("/admin", [role])).toBe(false);
    }
  });

  it("shows Administration only to the System Administrator", () => {
    expect(isNavItemVisible("/admin", ["SYSTEM_ADMINISTRATOR"])).toBe(true);
  });

  it("gives the Auditor read-only visibility into records, corrective actions and reports", () => {
    expect(isNavItemVisible("/records", ["AUDITOR"])).toBe(true);
    expect(isNavItemVisible("/corrective-actions", ["AUDITOR"])).toBe(true);
    expect(isNavItemVisible("/reports", ["AUDITOR"])).toBe(true);
    expect(isNavItemVisible("/records/new", ["AUDITOR"])).toBe(false);
  });

  it("gives QA Executive pending-verification, corrective action and report access but not task creation", () => {
    expect(isNavItemVisible("/records", ["QA_EXECUTIVE"])).toBe(true);
    expect(isNavItemVisible("/corrective-actions", ["QA_EXECUTIVE"])).toBe(true);
    expect(isNavItemVisible("/reports", ["QA_EXECUTIVE"])).toBe(true);
    expect(isNavItemVisible("/records/new", ["QA_EXECUTIVE"])).toBe(false);
  });

  it("grants access when a user holds any one of multiple roles", () => {
    expect(isNavItemVisible("/admin", ["FG_OPERATOR", "SYSTEM_ADMINISTRATOR"])).toBe(
      true,
    );
  });
});

describe("filterNavItemsByRole", () => {
  it("returns Home, Reports, Administration and Profile for a pure System Administrator", () => {
    const visible = filterNavItemsByRole(ALL_ITEMS, ["SYSTEM_ADMINISTRATOR"]);
    expect(visible.map((item) => item.href)).toEqual([
      "/",
      "/tasks",
      "/reports",
      "/admin",
      "/profile",
    ]);
  });

  it("returns the FG Operator's full operational surface", () => {
    const visible = filterNavItemsByRole(ALL_ITEMS, ["FG_OPERATOR"]);
    expect(visible.map((item) => item.href)).toEqual([
      "/",
      "/tasks",
      "/records/new",
      "/records",
      "/profile",
    ]);
  });
});
