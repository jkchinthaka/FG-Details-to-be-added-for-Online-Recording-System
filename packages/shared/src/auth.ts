import { z } from "zod";
import type { UserRole } from "./roles";
import type { PermissionKey } from "./permissions";
import { PASSWORD_MIN_LENGTH, usernameSchema } from "./username";

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
  username: usernameSchema,
  password: z.string().min(1, "Enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `New password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    ),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Machine-readable auth error codes returned by the API alongside a
 * human-readable `message`. The frontend switches on `code` (never on
 * message text) to decide which UI state to render.
 */
export const AUTH_ERROR_CODES = [
  "INVALID_CREDENTIALS",
  "INVALID_CURRENT_PASSWORD",
  "PASSWORD_REUSE",
  "ACCOUNT_INACTIVE",
  "ACCOUNT_LOCKED",
  "SESSION_EXPIRED",
  "TOKEN_REUSE_DETECTED",
  "NOT_AUTHENTICATED",
  "FORBIDDEN",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export type CurrentUser = {
  id: string;
  employeeCode: string;
  username: string | null;
  fullName: string;
  email: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_ACTIVATION";
  mustChangePassword: boolean;
  roles: UserRole[];
  permissions: PermissionKey[];
  lastLoginAt: string | null;
};
