import type { PermissionKey, UserRole } from "@nelna/shared";

/** Claims embedded in the short-lived access token. */
export type AccessTokenPayload = {
  sub: string;
  employeeCode: string;
  fullName: string;
  roles: UserRole[];
  permissions: PermissionKey[];
  authVersion: number;
};

/** Claims embedded in the rotating refresh token (kept minimal on purpose). */
export type RefreshTokenPayload = {
  sub: string;
  jti: string;
  authVersion: number;
  familyId: string;
  sessionId: string;
};

/**
 * Shape attached to `request.user` by JwtAuthGuard after cryptographic verify
 * plus a database reload of current status, authVersion, roles and permissions.
 */
export type RequestUser = {
  id: string;
  employeeCode: string;
  fullName: string;
  roles: UserRole[];
  permissions: PermissionKey[];
  mustChangePassword?: boolean;
  authVersion?: number;
};

declare module "express" {
  interface Request {
    user?: RequestUser;
  }
}
