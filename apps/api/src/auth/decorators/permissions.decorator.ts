import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "@nelna/shared";

export const PERMISSIONS_KEY = "permissions";

/** Restricts a route to users holding at least one of the given permissions. */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
