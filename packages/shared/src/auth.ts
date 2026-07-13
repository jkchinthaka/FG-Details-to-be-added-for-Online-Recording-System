import { z } from "zod";
import type { UserRole } from "./roles";
import type { PermissionKey } from "./permissions";

/**
 * Cookie names shared between the API (which sets/clears these httpOnly
 * cookies) and the web app's middleware (which only ever checks for their
 * *presence* — it never has access to the values, since they are httpOnly).
 */
export const AUTH_COOKIE_NAMES = {
  accessToken: "nelna_access_token",
  refreshToken: "nelna_refresh_token",
} as const;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Machine-readable auth error codes returned by the API alongside a
 * human-readable `message`. The frontend switches on `code` (never on
 * message text) to decide which UI state to render.
 */
export const AUTH_ERROR_CODES = [
  "INVALID_CREDENTIALS",
  "ACCOUNT_INACTIVE",
  "ACCOUNT_LOCKED",
  "SESSION_EXPIRED",
  "NOT_AUTHENTICATED",
  "FORBIDDEN",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export type CurrentUser = {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_ACTIVATION";
  roles: UserRole[];
  permissions: PermissionKey[];
  lastLoginAt: string | null;
};
