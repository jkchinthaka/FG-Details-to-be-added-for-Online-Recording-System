import type { UserRole } from "@nelna/shared";

/**
 * Admin-facing user shapes. Deliberately never include `passwordHash` or any
 * refresh-token secret — see the module-level guarantee in users.service.ts.
 */
export type AdminUserSummary = {
  id: string;
  employeeCode: string;
  username: string | null;
  fullName: string;
  email: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_ACTIVATION";
  mustChangePassword: boolean;
  department: { id: string; name: string; code: string } | null;
  section: { id: string; name: string; code: string } | null;
  roles: UserRole[];
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserListResponse = {
  items: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUserAccessHistoryEntry = {
  id: string;
  familyId: string;
  sessionId: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
  userAgent: string | null;
  ipAddress: string | null;
};

export type AdminUserAccessHistoryResponse = {
  lastLoginAt: string | null;
  sessions: AdminUserAccessHistoryEntry[];
};

export type AdminPasswordResetResponse = {
  temporaryPassword: string;
};
