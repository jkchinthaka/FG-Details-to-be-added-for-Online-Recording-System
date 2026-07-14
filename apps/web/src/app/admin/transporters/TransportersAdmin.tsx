"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
} from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";
import {
  AdminApiError,
  createAdminTransporter,
  fetchAdminTransporters,
  setTransporterActive,
  type AdminTransporter,
} from "@/lib/admin/api";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; transporters: AdminTransporter[] };

const EMPTY_FORM = { name: "", contactPhone: "", contactEmail: "" };

export function TransportersAdmin() {
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
    fetchAdminTransporters()
      .then((transporters) => setListState({ status: "ready", transporters }))
      .catch((error: unknown) => {
        const messageText =
          error instanceof AdminApiError ? error.message : "Failed to load transporters.";
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
      await createAdminTransporter({
        name: form.name.trim(),
        contactPhone: form.contactPhone.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      reload();
    } catch (error) {
      setCreateError(
        error instanceof AdminApiError
          ? error.message
          : "Failed to register transporter.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(transporter: AdminTransporter) {
    setActionError(null);
    setMessage(null);
    try {
      await setTransporterActive(transporter.id, !transporter.isActive);
      setMessage(
        `${transporter.name} ${transporter.isActive ? "deactivated" : "activated"}.`,
      );
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
        <PageHeader eyebrow="Administration" title="Transporters" />
        <Alert tone="danger" title="Not authorized">
          Managing fleet master data requires the &quot;master_data:manage&quot;
          permission.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Transporters"
        description="Manage the transporter companies used across the fleet."
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
        <h2
          className="text-nelna-primary-dark text-lg"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Register transporter
        </h2>
        <form
          onSubmit={handleCreate}
          style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}
        >
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Contact phone"
              value={form.contactPhone}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            />
            <Input
              label="Contact email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            />
          </div>
          {createError ? (
            <Alert tone="danger" title="Could not register transporter">
              {createError}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" loading={creating}>
              Register transporter
            </Button>
          </div>
        </form>
      </Card>

      {listState.status === "loading" ? (
        <LoadingState message="Loading transporters…" />
      ) : null}
      {listState.status === "error" ? (
        <Alert tone="danger" title="Could not load transporters">
          {listState.message}
        </Alert>
      ) : null}
      {listState.status === "ready" && listState.transporters.length === 0 ? (
        <EmptyState
          title="No transporters yet"
          description="Register the first transporter above."
        />
      ) : null}

      {listState.status === "ready" && listState.transporters.length > 0 ? (
        <Card padding="lg">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Phone</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listState.transporters.map((t) => (
                  <tr key={t.id} style={{ borderTop: "1px solid var(--nelna-border)" }}>
                    <td style={{ padding: "0.5rem" }}>{t.name}</td>
                    <td style={{ padding: "0.5rem" }}>{t.contactPhone ?? "—"}</td>
                    <td style={{ padding: "0.5rem" }}>{t.contactEmail ?? "—"}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <Badge tone={t.isActive ? "success" : "neutral"}>
                        {t.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <Button
                        variant={t.isActive ? "danger" : "secondary"}
                        onClick={() => handleToggleActive(t)}
                      >
                        {t.isActive ? "Deactivate" : "Activate"}
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
