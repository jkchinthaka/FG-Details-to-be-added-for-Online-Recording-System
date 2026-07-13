import type { UserRole } from "@nelna/shared";

/**
 * Which roles can see each nav destination. `undefined` means "every
 * authenticated user" (e.g. Home, Profile). Kept as a plain lookup so it's
 * trivial to unit test and to extend as new pages land.
 *
 * Mapping rationale (see docs/AUTHENTICATION.md for the full table):
 *  - Everyone: "/tasks" is now the universal "Today's Tasks" dashboard home —
 *    every role sees its own widgets there (operator assignments, supervisor
 *    checks, QA verifications/exceptions, food-safety compliance snapshot,
 *    admin shortcuts). "/" redirects here for every authenticated user.
 *  - FG Operator: today's tasks, creating + viewing their own records.
 *  - FG Supervisor: operator's view plus corrective actions (assign/escalate).
 *  - QA Executive / Food Safety Team Leader: records (to verify), corrective
 *    actions and reports — the quality-oversight surfaces.
 *  - System Administrator: Administration only, alongside Home/Profile.
 *  - Auditor: read-only visibility into records, corrective actions and
 *    reports (the pages themselves don't yet gate individual actions by
 *    permission, but the nav intentionally mirrors read-only scope).
 */
export const NAV_ROLE_MAP: Record<string, UserRole[] | undefined> = {
  "/": undefined,
  "/tasks": undefined,
  "/records/new": ["FG_OPERATOR", "FG_SUPERVISOR"],
  "/records": [
    "FG_OPERATOR",
    "FG_SUPERVISOR",
    "QA_EXECUTIVE",
    "FOOD_SAFETY_TEAM_LEADER",
    "AUDITOR",
  ],
  "/corrective-actions": ["FG_SUPERVISOR", "QA_EXECUTIVE", "FOOD_SAFETY_TEAM_LEADER", "AUDITOR"],
  "/reports": ["QA_EXECUTIVE", "FOOD_SAFETY_TEAM_LEADER", "AUDITOR", "SYSTEM_ADMINISTRATOR"],
  "/admin": ["SYSTEM_ADMINISTRATOR"],
  "/profile": undefined,
};

/** True when at least one of `userRoles` is allowed to see `href` per NAV_ROLE_MAP. */
export function isNavItemVisible(href: string, userRoles: UserRole[]): boolean {
  const allowedRoles = NAV_ROLE_MAP[href];
  if (!allowedRoles) return true;
  return allowedRoles.some((role) => userRoles.includes(role));
}

/** Filters a list of `{ href }` nav items down to the ones visible for `userRoles`. */
export function filterNavItemsByRole<T extends { href: string }>(
  items: T[],
  userRoles: UserRole[],
): T[] {
  return items.filter((item) => isNavItemVisible(item.href, userRoles));
}
