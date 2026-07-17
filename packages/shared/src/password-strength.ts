import { PASSWORD_MIN_LENGTH } from "./username";

export type PasswordRequirementId =
  | "length"
  | "uppercase"
  | "lowercase"
  | "number"
  | "symbol"
  | "different";

export type PasswordRequirement = {
  id: PasswordRequirementId;
  label: string;
  met: boolean;
};

export type PasswordStrengthLabel = "Weak" | "Fair" | "Good" | "Strong";

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: PasswordStrengthLabel;
  requirements: PasswordRequirement[];
  allRequiredMet: boolean;
};

const SYMBOL_PATTERN = /[^A-Za-z0-9]/;

/**
 * Evaluates password requirements for first-login / change-password UX.
 * Does not claim cryptographic strength — guidance for operators only.
 */
export function evaluatePasswordStrength(
  password: string,
  currentPassword = "",
): PasswordStrength {
  const requirements: PasswordRequirement[] = [
    {
      id: "length",
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: "uppercase",
      label: "One uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lowercase",
      label: "One lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      id: "number",
      label: "One number",
      met: /\d/.test(password),
    },
    {
      id: "symbol",
      label: "One symbol (for example ! @ # $)",
      met: SYMBOL_PATTERN.test(password),
    },
    {
      id: "different",
      label: "Different from your temporary password",
      met:
        password.length > 0 &&
        currentPassword.length > 0 &&
        password !== currentPassword,
    },
  ];

  const coreMet = requirements
    .filter((r) => r.id !== "different")
    .filter((r) => r.met).length;
  const different = requirements.find((r) => r.id === "different")?.met ?? false;
  const allRequiredMet =
    requirements.filter((r) => r.id !== "different").every((r) => r.met) &&
    (currentPassword.length === 0 || different);

  let score: PasswordStrength["score"] = 0;
  if (coreMet >= 1) score = 1;
  if (coreMet >= 3) score = 2;
  if (coreMet >= 5) score = 3;
  if (coreMet >= 5 && different) score = 4;

  const label: PasswordStrengthLabel =
    score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";

  return { score, label, requirements, allRequiredMet };
}
