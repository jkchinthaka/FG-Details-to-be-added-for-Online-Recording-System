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
  createAdminVehicle,
  fetchAdminVehicles,
  fetchVehicleInspectionHistory,
  setVehicleActive,
  setVehicleQrIdentifier,
  type AdminVehicle,
} from "@/lib/admin/api";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; vehicles: AdminVehicle[] };

const EMPTY_FORM = { vehicleNumber: "", freezerTruckNumber: "", qrIdentifier: "" };

export function VehiclesAdmin() {
  const { status: authStatus, user } = useAuth();
  const canManage = Boolean(user?.permissions.includes("master_data:manage"));

  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [qrEdits, setQrEdits] = useState<Record<string, string>>({});
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<Awaited<
    ReturnType<typeof fetchVehicleInspectionHistory>
  > | null>(null);

  const reload = useCallback(() => {
    setListState({ status: "loading" });
    fetchAdminVehicles()
      .then((vehicles) => setListState({ status: "ready", vehicles }))
      .catch((error: unknown) => {
        const messageText =
          error instanceof AdminApiError ? error.message : "Failed to load vehicles.";
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
      await createAdminVehicle({
        vehicleNumber: form.vehicleNumber.trim(),
        freezerTruckNumber: form.freezerTruckNumber.trim() || undefined,
        qrIdentifier: form.qrIdentifier.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      reload();
    } catch (error) {
      setCreateError(
        error instanceof AdminApiError ? error.message : "Failed to register vehicle.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(vehicle: AdminVehicle) {
    setActionError(null);
    setMessage(null);
    try {
      await setVehicleActive(vehicle.id, vehicle.status !== "ACTIVE");
      setMessage(
        `${vehicle.vehicleNumber} ${vehicle.status === "ACTIVE" ? "deactivated" : "activated"}.`,
      );
      reload();
    } catch (error) {
      setActionError(error instanceof AdminApiError ? error.message : "Action failed.");
    }
  }

  async function handleSaveQr(vehicle: AdminVehicle) {
    const qrIdentifier = qrEdits[vehicle.id];
    if (!qrIdentifier) return;
    setActionError(null);
    setMessage(null);
    try {
      await setVehicleQrIdentifier(vehicle.id, qrIdentifier.trim());
      setMessage(`QR identifier updated for ${vehicle.vehicleNumber}.`);
      reload();
    } catch (error) {
      setActionError(
        error instanceof AdminApiError ? error.message : "Failed to set QR identifier.",
      );
    }
  }

  async function handleShowHistory(vehicle: AdminVehicle) {
    setHistoryFor(vehicle.id);
    setHistory(null);
    try {
      const rows = await fetchVehicleInspectionHistory(vehicle.id);
      setHistory(rows);
    } catch (error) {
      setActionError(
        error instanceof AdminApiError
          ? error.message
          : "Failed to load inspection history.",
      );
    }
  }

  if (authStatus === "loading") {
    return <LoadingState message="Checking your session…" />;
  }

  if (!canManage) {
    return (
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <PageHeader eyebrow="Administration" title="Vehicles" />
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
        title="Vehicles"
        description="Register freezer trucks, assign QR identifiers, and review inspection history."
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
          Register vehicle
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
              label="Vehicle number"
              required
              value={form.vehicleNumber}
              onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value }))}
            />
            <Input
              label="Freezer truck number"
              value={form.freezerTruckNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, freezerTruckNumber: e.target.value }))
              }
            />
            <Input
              label="QR identifier"
              value={form.qrIdentifier}
              onChange={(e) => setForm((f) => ({ ...f, qrIdentifier: e.target.value }))}
            />
          </div>
          {createError ? (
            <Alert tone="danger" title="Could not register vehicle">
              {createError}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" loading={creating}>
              Register vehicle
            </Button>
          </div>
        </form>
      </Card>

      {listState.status === "loading" ? (
        <LoadingState message="Loading vehicles…" />
      ) : null}
      {listState.status === "error" ? (
        <Alert tone="danger" title="Could not load vehicles">
          {listState.message}
        </Alert>
      ) : null}
      {listState.status === "ready" && listState.vehicles.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          description="Register the first freezer truck above."
        />
      ) : null}

      {listState.status === "ready" && listState.vehicles.length > 0 ? (
        <Card padding="lg">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Vehicle #</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>
                    Freezer truck #
                  </th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Transporter</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>QR identifier</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listState.vehicles.map((v) => (
                  <tr key={v.id} style={{ borderTop: "1px solid var(--nelna-border)" }}>
                    <td style={{ padding: "0.5rem" }}>{v.vehicleNumber}</td>
                    <td style={{ padding: "0.5rem" }}>{v.freezerTruckNumber ?? "—"}</td>
                    <td style={{ padding: "0.5rem" }}>{v.transporter?.name ?? "—"}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <Badge tone={v.status === "ACTIVE" ? "success" : "neutral"}>
                        {v.status}
                      </Badge>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <Input
                          label="QR identifier"
                          hideLabel
                          placeholder={v.qrIdentifier ?? "Not set"}
                          value={qrEdits[v.id] ?? ""}
                          onChange={(e) =>
                            setQrEdits((prev) => ({ ...prev, [v.id]: e.target.value }))
                          }
                          style={{ minWidth: "140px" }}
                        />
                        <Button variant="secondary" onClick={() => handleSaveQr(v)}>
                          Save
                        </Button>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        display: "flex",
                        gap: "0.4rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        variant={v.status === "ACTIVE" ? "danger" : "secondary"}
                        onClick={() => handleToggleActive(v)}
                      >
                        {v.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="ghost" onClick={() => handleShowHistory(v)}>
                        History
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {historyFor ? (
        <Card>
          <h2
            className="text-nelna-primary-dark text-lg"
            style={{ fontFamily: "var(--nelna-font-display)" }}
          >
            Inspection history
          </h2>
          {history === null ? <LoadingState message="Loading history…" /> : null}
          {history !== null && history.length === 0 ? (
            <EmptyState
              title="No inspections yet"
              description="This vehicle has no recorded inspections."
            />
          ) : null}
          {history !== null && history.length > 0 ? (
            <ul style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
              {history.map((entry) => (
                <li
                  key={entry.id}
                  style={{
                    borderBottom: "1px solid var(--nelna-border)",
                    paddingBottom: "0.5rem",
                  }}
                >
                  Record {entry.recordId} — decision: {entry.loadingDecision}
                  {entry.recommendedDecision
                    ? ` (recommended: ${entry.recommendedDecision})`
                    : ""}{" "}
                  — {new Date(entry.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
