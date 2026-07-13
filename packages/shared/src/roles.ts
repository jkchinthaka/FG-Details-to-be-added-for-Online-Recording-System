/** System roles for Nelna FG Digital Recording System */
export const USER_ROLES = [
  "FG_OPERATOR",
  "FG_SUPERVISOR",
  "QA_EXECUTIVE",
  "FOOD_SAFETY_TEAM_LEADER",
  "SYSTEM_ADMINISTRATOR",
  "AUDITOR",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  FG_OPERATOR: "FG Operator",
  FG_SUPERVISOR: "FG Supervisor",
  QA_EXECUTIVE: "QA Executive",
  FOOD_SAFETY_TEAM_LEADER: "Food Safety Team Leader",
  SYSTEM_ADMINISTRATOR: "System Administrator",
  AUDITOR: "Auditor",
};
