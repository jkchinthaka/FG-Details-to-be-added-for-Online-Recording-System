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

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/unauthorized",
  "/account-inactive",
  "/offline",
  "/release",
];

/** Password-change page is gated by verified session, not fully public. */
export function isChangePasswordPath(pathname: string): boolean {
  return pathname === "/change-password" || pathname.startsWith("/change-password/");
}

/** Same-origin NestJS proxy paths — page middleware must never rewrite these. */
export function isApiProxyPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * Mirrors `middleware.ts` `config.matcher` exclusion for `/api` and static assets.
 * Used in unit tests so matcher regressions are caught without spinning up Next.
 */
export const PAGE_MIDDLEWARE_MATCHER =
  "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|release-manifest.json).*)";

export function pathMatchesPageMiddleware(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;
  const rest = pathname.slice(1);
  // Empty path after "/" is "/", which should match (home).
  if (rest === "") return true;
  return !/^(?:api|_next\/static|_next\/image|favicon\.ico|icons|manifest\.webmanifest|sw\.js|release-manifest\.json)(?:\/|$)/.test(
    rest,
  );
}

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
