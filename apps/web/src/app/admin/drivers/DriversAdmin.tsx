"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, LoadingState, PageHeader } from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";
import {
  AdminApiError,
  createAdminDriver,
  fetchAdminDrivers,
  setDriverActive,
  type AdminDriver,
} from "@/lib/admin/api";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; drivers: AdminDriver[] };

const EMPTY_FORM = { fullName: "", licenseNumber: "", phone: "" };

export function DriversAdmin() {
  const { status: authStatus, user } = useAuth();
  const canManage = Boolean(user?.permissions.includes("master_data:manage"));

  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setListState({ status: "loading" });
    fetchAdminDrivers()
      .then((drivers) => setListState({ status: "ready", drivers }))
      .catch((error: unknown) => {
        const messageText = error instanceof AdminApiError ? error.message : "Failed to load drivers.";
        setListState({ status: "error", message: messageText });
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
      await createAdminDriver({
        fullName: form.fullName.trim(),
        licenseNumber: form.licenseNumber.trim(),
        phone: form.phone.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      reload();
    } catch (error) {
      setCreateError(error instanceof AdminApiError ? error.message : "Failed to register driver.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(driver: AdminDriver) {
    setActionError(null);
    setMessage(null);
    try {
      await setDriverActive(driver.id, !driver.isActive);
      setMessage(`${driver.fullName} ${driver.isActive ? "deactivated" : "activated"}.`);
      reload();
    } catch (error) {
      setActionError(error instanceof AdminApiError ? error.message : "Action failed.");
    }
  }

  if (authStatus === "loading") {
    return <LoadingState message="Checking your session…" />;
  }

  if (!canManage) {
    return (
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <PageHeader eyebrow="Administration" title="Drivers" />
        <Alert tone="danger" title="Not authorized">
          Managing fleet master data requires the &quot;master_data:manage&quot; permission.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Drivers"
        description="Register drivers and manage license records."
      />

      {message ? (
        <Alert tone="success" title="Done">
          {message}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="danger" title="Action failed">
          {actionError}
        </Alert>
      ) : null}

      <Card>
        <h2 className="text-lg text-nelna-primary-dark" style={{ fontFamily: "var(--nelna-font-display)" }}>
          Register driver
        </h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Input
              label="Full name"
              required
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            />
            <Input
              label="License number"
              required
              value={form.licenseNumber}
              onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          {createError ? (
            <Alert tone="danger" title="Could not register driver">
              {createError}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" loading={creating}>
              Register driver
            </Button>
          </div>
        </form>
      </Card>

      {listState.status === "loading" ? <LoadingState message="Loading drivers…" /> : null}
      {listState.status === "error" ? (
        <Alert tone="danger" title="Could not load drivers">
          {listState.message}
        </Alert>
      ) : null}
      {listState.status === "ready" && listState.drivers.length === 0 ? (
        <EmptyState title="No drivers yet" description="Register the first driver above." />
      ) : null}

      {listState.status === "ready" && listState.drivers.length > 0 ? (
        <Card padding="lg">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>License #</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Phone</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listState.drivers.map((d) => (
                  <tr key={d.id} style={{ borderTop: "1px solid var(--nelna-border)" }}>
                    <td style={{ padding: "0.5rem" }}>{d.fullName}</td>
                    <td style={{ padding: "0.5rem" }}>{d.licenseNumber}</td>
                    <td style={{ padding: "0.5rem" }}>{d.phone ?? "—"}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <Badge tone={d.isActive ? "success" : "neutral"}>{d.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <Button variant={d.isActive ? "danger" : "secondary"} onClick={() => handleToggleActive(d)}>
                        {d.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
