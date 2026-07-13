import type { PermissionKey, UserRole } from "@nelna/shared";

/** Claims embedded in the short-lived access token. */
export type AccessTokenPayload = {
  sub: string;
  employeeCode: string;
  fullName: string;
  roles: UserRole[];
  permissions: PermissionKey[];
};

/** Claims embedded in the rotating refresh token (kept minimal on purpose). */
export type RefreshTokenPayload = {
  sub: string;
  jti: string;
};

/**
 * Shape attached to `request.user` by JwtAuthGuard. Derived entirely from the
 * verified access token — no per-request database lookup — so role/permission
 * changes made by an admin take effect on the user's next token refresh
 * rather than instantly. See docs/AUTHENTICATION.md for this trade-off.
 */
export type RequestUser = {
  id: string;
  employeeCode: string;
  fullName: string;
  roles: UserRole[];
  permissions: PermissionKey[];
};

declare module "express" {
  interface Request {
    user?: RequestUser;
  }
}
