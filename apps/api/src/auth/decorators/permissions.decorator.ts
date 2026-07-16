import { applyDecorators, SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "@nelna/shared";

export const PERMISSIONS_KEY = "permissions";
export const PERMISSIONS_MODE_KEY = "permissionsMode";

export type PermissionsMode = "any" | "all";

/** @deprecated Prefer RequireAnyPermission — historically OR semantics. */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  RequireAnyPermission(...permissions);

/** User must hold at least one listed permission. */
export function RequireAnyPermission(...permissions: PermissionKey[]) {
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_MODE_KEY, "any" as PermissionsMode),
  );
}

/** User must hold every listed permission. */
export function RequireAllPermissions(...permissions: PermissionKey[]) {
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_MODE_KEY, "all" as PermissionsMode),
  );
}
