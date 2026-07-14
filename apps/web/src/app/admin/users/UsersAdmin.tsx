"use client";

import { useCallback, useEffect, useState } from "react";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "@nelna/shared";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Input, LoadingState, Modal, PageHeader } from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";
import {
  AdminApiError,
  activateUser,
  assignUserRoles,
  createUser,
  deactivateUser,
  fetchUsers,
  resetUserPassword,
  type AdminUserSummary,
} from "@/lib/admin/api";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; users: AdminUserSummary[] };

const EMPTY_CREATE_FORM = {
  employeeCode: "",
  fullName: "",
  email: "",
  password: "",
  roleNames: [] as UserRole[],
};

export function UsersAdmin() {
  const { status: authStatus, user } = useAuth();
  const canManage = Boolean(user?.permissions.includes("users:manage"));

  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rolesTarget, setRolesTarget] = useState<AdminUserSummary | null>(null);
  const [rolesSelection, setRolesSelection] = useState<UserRole[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  const reload = useCallback(() => {
    setListState({ status: "loading" });
    fetchUsers()
      .then((response) => setListState({ status: "ready", users: response.items }))
      .catch((error: unknown) => {
        const message = error instanceof AdminApiError ? error.message : "Failed to load users.";
        setListState({ status: "error", message });
      });
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated" || !canManage) return;
    reload();
  }, [authStatus, canManage, reload]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createUser({
        employeeCode: createForm.employeeCode.trim(),
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim() || undefined,
        password: createForm.password,
        roleNames: createForm.roleNames,
      });
      setCreateForm(EMPTY_CREATE_FORM);
      reload();
    } catch (error) {
      setCreateError(error instanceof AdminApiError ? error.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(target: AdminUserSummary) {
    setActionError(null);
    setActionMessage(null);
    try {
      if (target.status === "ACTIVE") {
        await deactivateUser(target.id);
        setActionMessage(`${target.fullName} deactivated.`);
      } else {
        await activateUser(target.id);
        setActionMessage(`${target.fullName} activated.`);
      }
      reload();
    } catch (error) {
      setActionError(error instanceof AdminApiError ? error.message : "Action failed.");
    }
  }

  async function handleResetPassword(target: AdminUserSummary) {
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await resetUserPassword(target.id);
      setActionMessage(`Temporary password for ${target.fullName}: ${result.temporaryPassword}`);
    } catch (error) {
      setActionError(error instanceof AdminApiError ? error.message : "Password reset failed.");
    }
  }

  function openRolesModal(target: AdminUserSummary) {
    setRolesTarget(target);
    setRolesSelection(target.roles);
  }

  async function handleSaveRoles() {
    if (!rolesTarget) return;
    setSavingRoles(true);
    setActionError(null);
    try {
      await assignUserRoles(rolesTarget.id, rolesSelection);
      setActionMessage(`Roles updated for ${rolesTarget.fullName}.`);
      setRolesTarget(null);
      reload();
    } catch (error) {
      setActionError(error instanceof AdminApiError ? error.message : "Failed to update roles.");
    } finally {
      setSavingRoles(false);
    }
  }

  if (authStatus === "loading") {
    return <LoadingState message="Checking your session…" />;
  }

  if (!canManage) {
    return (
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <PageHeader eyebrow="Administration" title="Users" />
        <Alert tone="danger" title="Not authorized">
          Managing users requires the &quot;users:manage&quot; permission.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Create accounts, manage department/role assignments, and reset passwords."
      />

      {actionMessage ? (
        <Alert tone="success" title="Done">
          {actionMessage}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="danger" title="Action failed">
          {actionError}
        </Alert>
      ) : null}

      <Card>
        <h2 className="text-lg text-nelna-primary-dark" style={{ fontFamily: "var(--nelna-font-display)" }}>
          Create user
        </h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Input
              label="Employee code"
              required
              value={createForm.employeeCode}
              onChange={(e) => setCreateForm((f) => ({ ...f, employeeCode: e.target.value }))}
            />
            <Input
              label="Full name"
              required
              value={createForm.fullName}
              onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Temporary password"
              type="password"
              required
              minLength={8}
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="nelna-field-label" style={{ marginBottom: "0.35rem" }}>
              Roles
            </legend>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {USER_ROLES.map((role) => (
                <Checkbox
                  key={role}
                  label={USER_ROLE_LABELS[role]}
                  checked={createForm.roleNames.includes(role)}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      roleNames: e.target.checked
                        ? [...f.roleNames, role]
                        : f.roleNames.filter((r) => r !== role),
                    }))
                  }
                />
              ))}
            </div>
          </fieldset>
          {createError ? (
            <Alert tone="danger" title="Could not create user">
              {createError}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" loading={creating}>
              Create user
            </Button>
          </div>
        </form>
      </Card>

      {listState.status === "loading" ? <LoadingState message="Loading users…" /> : null}
      {listState.status === "error" ? (
        <Alert tone="danger" title="Could not load users">
          {listState.message}
        </Alert>
      ) : null}
      {listState.status === "ready" && listState.users.length === 0 ? (
        <EmptyState title="No users yet" description="Create the first user account above." />
      ) : null}

      {listState.status === "ready" && listState.users.length > 0 ? (
        <Card padding="lg">
          <div style={{ overflowX: "auto" }}>
            <table className="nelna-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Employee</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Roles</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Last login</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listState.users.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--nelna-border)" }}>
                    <td style={{ padding: "0.5rem" }}>{u.employeeCode}</td>
                    <td style={{ padding: "0.5rem" }}>{u.fullName}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {u.roles.length === 0 ? (
                        <span style={{ color: "var(--nelna-text-muted)" }}>—</span>
                      ) : (
                        u.roles.map((r) => (
                          <Badge key={r} tone="neutral">
                            {USER_ROLE_LABELS[r] ?? r}
                          </Badge>
                        ))
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <Badge tone={u.status === "ACTIVE" ? "success" : "neutral"}>{u.status}</Badge>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                    </td>
                    <td style={{ padding: "0.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <Button variant="secondary" onClick={() => openRolesModal(u)}>
                        Roles
                      </Button>
                      <Button
                        variant={u.status === "ACTIVE" ? "danger" : "secondary"}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="ghost" onClick={() => handleResetPassword(u)}>
                        Reset password
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Modal open={rolesTarget !== null} onClose={() => setRolesTarget(null)} title={`Roles — ${rolesTarget?.fullName ?? ""}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRolesTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoles} loading={savingRoles}>
              Save roles
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {USER_ROLES.map((role) => (
            <Checkbox
              key={role}
              label={USER_ROLE_LABELS[role]}
              checked={rolesSelection.includes(role)}
              onChange={(e) =>
                setRolesSelection((prev) =>
                  e.target.checked ? [...prev, role] : prev.filter((r) => r !== role),
                )
              }
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}
