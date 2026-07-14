import type { UserRole } from "@nelna/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new AdminApiError(
      0,
      "Could not reach the server. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join("; ");
      else if (body.message) message = body.message;
    } catch {
      // Non-JSON error body — fall back to the generic message above.
    }
    throw new AdminApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type AdminUserSummary = {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_ACTIVATION";
  department: { id: string; name: string; code: string } | null;
  section: { id: string; name: string; code: string } | null;
  roles: UserRole[];
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserListResponse = {
  items: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUserAccessHistoryResponse = {
  lastLoginAt: string | null;
  sessions: Array<{
    id: string;
    issuedAt: string;
    expiresAt: string;
    revokedAt: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  }>;
};

export function fetchUsers(
  params: { search?: string; status?: string } = {},
): Promise<AdminUserListResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<AdminUserListResponse>(`/admin/users${suffix}`);
}

export function createUser(body: {
  employeeCode: string;
  fullName: string;
  email?: string;
  password: string;
  roleNames?: UserRole[];
}): Promise<AdminUserSummary> {
  return post("/admin/users", body);
}

export function activateUser(id: string): Promise<AdminUserSummary> {
  return post(`/admin/users/${id}/activate`);
}

export function deactivateUser(id: string): Promise<AdminUserSummary> {
  return post(`/admin/users/${id}/deactivate`);
}

export function assignUserRoles(
  id: string,
  roleNames: UserRole[],
): Promise<AdminUserSummary> {
  return patch(`/admin/users/${id}/roles`, { roleNames });
}

export function resetUserPassword(id: string): Promise<{ temporaryPassword: string }> {
  return post(`/admin/users/${id}/reset-password`);
}

export function fetchUserAccessHistory(
  id: string,
): Promise<AdminUserAccessHistoryResponse> {
  return apiFetch(`/admin/users/${id}/access-history`);
}

// ---------------------------------------------------------------------------
// Vehicles / drivers / transporters
// ---------------------------------------------------------------------------

export type AdminTransporter = {
  id: string;
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
};

export type AdminVehicle = {
  id: string;
  vehicleNumber: string;
  freezerTruckNumber: string | null;
  qrIdentifier: string | null;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  transporter: { id: string; name: string } | null;
  transporterId: string | null;
};

export type AdminDriver = {
  id: string;
  fullName: string;
  licenseNumber: string;
  phone: string | null;
  isActive: boolean;
  transporterId: string | null;
};

export function fetchAdminVehicles(): Promise<AdminVehicle[]> {
  return apiFetch("/admin/vehicles");
}

export function createAdminVehicle(body: {
  vehicleNumber: string;
  freezerTruckNumber?: string;
  qrIdentifier?: string;
  transporterId?: string;
}): Promise<AdminVehicle> {
  return post("/admin/vehicles", body);
}

export function setVehicleActive(id: string, isActive: boolean): Promise<AdminVehicle> {
  return post(`/admin/vehicles/${id}/${isActive ? "activate" : "deactivate"}`);
}

export function setVehicleQrIdentifier(
  id: string,
  qrIdentifier: string,
): Promise<AdminVehicle> {
  return patch(`/admin/vehicles/${id}/qr-identifier`, { qrIdentifier });
}

export function fetchVehicleInspectionHistory(id: string): Promise<
  Array<{
    id: string;
    recordId: string;
    loadingDecision: string;
    recommendedDecision: string | null;
    decidedAt: string | null;
    createdAt: string;
  }>
> {
  return apiFetch(`/admin/vehicles/${id}/inspection-history`);
}

export function fetchAdminDrivers(): Promise<AdminDriver[]> {
  return apiFetch("/admin/drivers");
}

export function createAdminDriver(body: {
  fullName: string;
  licenseNumber: string;
  phone?: string;
  transporterId?: string;
}): Promise<AdminDriver> {
  return post("/admin/drivers", body);
}

export function setDriverActive(id: string, isActive: boolean): Promise<AdminDriver> {
  return post(`/admin/drivers/${id}/${isActive ? "activate" : "deactivate"}`);
}

export function fetchAdminTransporters(): Promise<AdminTransporter[]> {
  return apiFetch("/admin/transporters");
}

export function createAdminTransporter(body: {
  name: string;
  contactPhone?: string;
  contactEmail?: string;
}): Promise<AdminTransporter> {
  return post("/admin/transporters", body);
}

export function setTransporterActive(
  id: string,
  isActive: boolean,
): Promise<AdminTransporter> {
  return post(`/admin/transporters/${id}/${isActive ? "activate" : "deactivate"}`);
}

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

export type MasterDataRow = {
  id: string;
  code: string;
  name?: string;
  label?: string;
  description?: string | null;
  minCelsius?: number;
  maxCelsius?: number;
  startTime?: string;
  endTime?: string;
  departmentId?: string;
  isActive: boolean;
};

export type LoadingDecisionPolicyRow = {
  id: string;
  key: string;
  description: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
};

export type MasterDataResource =
  | "departments"
  | "sections"
  | "shifts"
  | "failure-reasons"
  | "corrective-action-categories"
  | "temperature-profiles";

export function fetchMasterData(resource: MasterDataResource): Promise<MasterDataRow[]> {
  return apiFetch(`/admin/master-data/${resource}`);
}

export function createMasterData(
  resource: MasterDataResource,
  body: Record<string, unknown>,
): Promise<MasterDataRow> {
  return post(`/admin/master-data/${resource}`, body);
}

export function setMasterDataActive(
  resource: MasterDataResource,
  id: string,
  isActive: boolean,
): Promise<MasterDataRow> {
  return post(
    `/admin/master-data/${resource}/${id}/${isActive ? "activate" : "deactivate"}`,
  );
}

export function fetchPriorities(): Promise<Array<{ value: string; label: string }>> {
  return apiFetch("/admin/master-data/priorities");
}

export function fetchLoadingDecisionPolicies(): Promise<LoadingDecisionPolicyRow[]> {
  return apiFetch("/admin/master-data/loading-decision-policies");
}

export function upsertLoadingDecisionPolicy(
  key: string,
  body: { description?: string; config: Record<string, unknown>; isActive?: boolean },
): Promise<LoadingDecisionPolicyRow> {
  return post(
    `/admin/master-data/loading-decision-policies/${encodeURIComponent(key)}`,
    body,
  );
}
