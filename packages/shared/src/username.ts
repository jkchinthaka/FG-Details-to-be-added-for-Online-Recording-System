import { z } from "zod";

/** Lowercase username: letters, digits, dot, underscore, hyphen; 4–40 chars. */
export const USERNAME_PATTERN = /^[a-z0-9._-]{4,40}$/;

export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 40;

export const PASSWORD_MIN_LENGTH = 12;

/**
 * Normalizes a raw username for storage and lookup (trim + lowercase).
 * Does not validate — call `isValidUsername` after normalizing.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(normalized: string): boolean {
  return USERNAME_PATTERN.test(normalized);
}

export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Enter your username")
  .transform(normalizeUsername)
  .refine(isValidUsername, {
    message:
      "Username must be 4–40 characters: letters, numbers, dot, underscore or hyphen only",
  });

/** Builds the archived username assigned to legacy users during migration. */
export function archivedUsernameForEmployeeCode(employeeCode: string): string {
  const normalized = employeeCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-");
  const candidate = `archived-${normalized}`;
  if (isValidUsername(candidate)) return candidate;
  const trimmed = candidate.slice(0, USERNAME_MAX_LENGTH);
  return trimmed.length >= USERNAME_MIN_LENGTH
    ? trimmed
    : `archived-${normalized.slice(0, USERNAME_MAX_LENGTH - "archived-".length)}`;
}
