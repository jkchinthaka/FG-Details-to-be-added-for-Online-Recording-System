import { describe, expect, it } from "vitest";
import { evaluatePasswordStrength } from "./password-strength";
import { changePasswordSchema } from "./auth";

describe("evaluatePasswordStrength", () => {
  it("marks short passwords as weak", () => {
    const result = evaluatePasswordStrength("abc", "temp-password-12");
    expect(result.label).toBe("Weak");
    expect(result.requirements.find((r) => r.id === "length")?.met).toBe(false);
  });

  it("requires difference from temporary password", () => {
    const same = evaluatePasswordStrength("SecurePass!234", "SecurePass!234");
    expect(same.requirements.find((r) => r.id === "different")?.met).toBe(false);
    const different = evaluatePasswordStrength("SecurePass!999", "SecurePass!234");
    expect(different.requirements.find((r) => r.id === "different")?.met).toBe(true);
  });

  it("reaches strong when all rules met", () => {
    const result = evaluatePasswordStrength("SecurePass!999", "temp-password-12");
    expect(result.allRequiredMet).toBe(true);
    expect(result.label).toBe("Strong");
  });
});

describe("changePasswordSchema", () => {
  it("rejects password equal to current", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "TempPass!2345",
      newPassword: "TempPass!2345",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a compliant new password", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "TempPass!2345",
      newPassword: "BetterPass!9999",
    });
    expect(parsed.success).toBe(true);
  });
});
