import type { PermissionKey, UserRole } from "@nelna/shared";

/**
 * Permission-aware route access for server middleware and client gates.
 * Prefix match: longest matching key wins. `undefined` roles = any authenticated user.
 */
export type RouteAccessRule = {
  /** Path prefix (exact or trailing subtree). */
  prefix: string;
  roles?: UserRole[];
  /** If set, user needs at least one of these permissions (OR). */
  permissions?: PermissionKey[];
};

export const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  {
    prefix: "/admin",
    roles: ["SYSTEM_ADMINISTRATOR"],
    permissions: ["users:manage", "master_data:manage", "templates:manage"],
  },
  {
    prefix: "/reports",
    roles: [
      "QA_EXECUTIVE",
      "FOOD_SAFETY_TEAM_LEADER",
      "AUDITOR",
      "SYSTEM_ADMINISTRATOR",
      "FG_SUPERVISOR",
    ],
    permissions: ["reports:read", "audit:read", "records:check"],
  },
  {
    prefix: "/records/pending-check",
    roles: ["FG_SUPERVISOR", "SYSTEM_ADMINISTRATOR"],
    permissions: ["records:check"],
  },
  {
    prefix: "/records/pending-verification",
    roles: ["QA_EXECUTIVE", "FOOD_SAFETY_TEAM_LEADER", "SYSTEM_ADMINISTRATOR"],
    permissions: ["records:verify"],
  },
  {
    prefix: "/corrective-actions",
    roles: [
      "FG_SUPERVISOR",
      "QA_EXECUTIVE",
      "FOOD_SAFETY_TEAM_LEADER",
      "AUDITOR",
      "SYSTEM_ADMINISTRATOR",
    ],
    permissions: ["corrective_actions:read", "corrective_actions:manage"],
  },
  {
    prefix: "/records/new",
    roles: ["FG_OPERATOR", "FG_SUPERVISOR"],
    permissions: ["records:create"],
  },
  {
    prefix: "/records",
    roles: [
      "FG_OPERATOR",
      "FG_SUPERVISOR",
      "QA_EXECUTIVE",
      "FOOD_SAFETY_TEAM_LEADER",
      "AUDITOR",
      "SYSTEM_ADMINISTRATOR",
    ],
    permissions: ["records:read"],
  },
];

const PUBLIC_PATH_PREFIXES = ["/login", "/unauthorized", "/account-inactive", "/offline"];

export function isPublicAppPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function matchingRule(pathname: string): RouteAccessRule | undefined {
  return ROUTE_ACCESS_RULES.filter(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
}

export function canAccessRoute(
  pathname: string,
  roles: readonly UserRole[],
  permissions: readonly PermissionKey[] = [],
): boolean {
  if (isPublicAppPath(pathname)) return true;
  const rule = matchingRule(pathname);
  if (!rule) return true; // authenticated-only pages without a tighter rule
  if (rule.roles?.some((role) => roles.includes(role))) return true;
  if (rule.permissions?.some((permission) => permissions.includes(permission)))
    return true;
  return false;
}
