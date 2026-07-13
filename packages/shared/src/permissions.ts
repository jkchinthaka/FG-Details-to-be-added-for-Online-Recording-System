/**
 * Canonical permission keys for the Nelna FG Digital Recording System.
 *
 * Single source of truth shared by the API's seed data (role → permission
 * mapping) and the PermissionsGuard/@Permissions() decorator, so the two can
 * never silently drift apart.
 */
export const PERMISSIONS = [
  "users:manage",
  "roles:manage",
  "templates:manage",
  "templates:publish",
  "master_data:manage",
  "records:create",
  "records:read",
  "records:check",
  "records:verify",
  "corrective_actions:manage",
  "corrective_actions:read",
  "reports:read",
  "audit:read",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];
