import { describe, expect, it } from "vitest";
import {
  archivedUsernameForEmployeeCode,
  isValidUsername,
  normalizeUsername,
} from "./username";

describe("normalizeUsername", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  FG.Operator01  ")).toBe("fg.operator01");
  });
});

describe("isValidUsername", () => {
  it("accepts valid usernames", () => {
    expect(isValidUsername("fg.operator01")).toBe(true);
    expect(isValidUsername("user_1-test")).toBe(true);
  });

  it("rejects too short, too long, spaces and invalid characters", () => {
    expect(isValidUsername("abc")).toBe(false);
    expect(isValidUsername("a".repeat(41))).toBe(false);
    expect(isValidUsername("has space")).toBe(false);
    expect(isValidUsername("bad@char")).toBe(false);
  });
});

describe("archivedUsernameForEmployeeCode", () => {
  it("prefixes normalized employee code", () => {
    expect(archivedUsernameForEmployeeCode("EMP-ADMIN-001")).toBe(
      "archived-emp-admin-001",
    );
  });
});
