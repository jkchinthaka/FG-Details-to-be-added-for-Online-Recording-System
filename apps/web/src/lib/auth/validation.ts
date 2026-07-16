import { loginSchema, type LoginInput } from "@nelna/shared";

export { loginSchema };
export type { LoginInput };

export type LoginFieldErrors = Partial<Record<keyof LoginInput, string>>;

/**
 * Validates raw login form values against the shared zod schema. Returns
 * field-level error messages for the login form, or `null` when the input
 * is valid — pure and framework-agnostic so it's trivial to unit test.
 */
export function validateLogin(input: {
  username: string;
  password: string;
}): LoginFieldErrors | null {
  const result = loginSchema.safeParse(input);
  if (result.success) return null;

  const errors: LoginFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if ((field === "username" || field === "password") && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
