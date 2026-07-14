"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, LoadingState, PageHeader, Select, Textarea } from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";
import {
  AdminApiError,
  createMasterData,
  fetchLoadingDecisionPolicies,
  fetchMasterData,
  fetchPriorities,
  setMasterDataActive,
  upsertLoadingDecisionPolicy,
  type LoadingDecisionPolicyRow,
  type MasterDataResource,
  type MasterDataRow,
} from "@/lib/admin/api";

type TabId =
  | "departments"
  | "sections"
  | "shifts"
  | "failure-reasons"
  | "corrective-action-categories"
  | "temperature-profiles"
  | "priorities"
  | "loading-decision-policies";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "departments", label: "Departments" },
  { id: "sections", label: "Sections" },
  { id: "shifts", label: "Shifts" },
  { id: "failure-reasons", label: "Failure reasons" },
  { id: "corrective-action-categories", label: "Corrective action categories" },
  { id: "temperature-profiles", label: "Temperature profiles" },
  { id: "priorities", label: "Priorities" },
  { id: "loading-decision-policies", label: "Loading decision policies" },
];

export function MasterDataAdmin() {
  const { status: authStatus, user } = useAuth();
  const canManage = Boolean(user?.permissions.includes("master_data:manage"));
  const [tab, setTab] = useState<TabId>("departments");

  if (authStatus === "loading") {
    return <LoadingState message="Checking your session…" />;
  }

  if (!canManage) {
    return (
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <PageHeader eyebrow="Administration" title="Master data" />
        <Alert tone="danger" title="Not authorized">
          Managing master data requires the &quot;master_data:manage&quot; permission.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Master data"
        description="Manage the shared reference data used across checklists and records. Rows already referenced historically are deactivated, not deleted."
      />

      <div role="tablist" aria-label="Master data category" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Button key={t.id} variant={t.id === tab ? "primary" : "secondary"} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "departments" ? (
        <SimpleResourceTab
          resource="departments"
          title="Departments"
          fields={[
            { key: "code", label: "Code" },
            { key: "name", label: "Name" },
            { key: "description", label: "Description", optional: true },
          ]}
          columns={["code", "name", "description"]}
        />
      ) : null}

      {tab === "sections" ? <SectionsTab /> : null}

      {tab === "shifts" ? (
        <SimpleResourceTab
          resource="shifts"
          title="Shifts"
          fields={[
            { key: "code", label: "Code" },
            { key: "name", label: "Name" },
            { key: "startTime", label: "Start time (HH:mm)" },
            { key: "endTime", label: "End time (HH:mm)" },
          ]}
          columns={["code", "name", "startTime", "endTime"]}
        />
      ) : null}

      {tab === "failure-reasons" ? (
        <SimpleResourceTab
          resource="failure-reasons"
          title="Failure reasons"
          fields={[
            { key: "code", label: "Code" },
            { key: "label", label: "Label" },
          ]}
          columns={["code", "label"]}
        />
      ) : null}

      {tab === "corrective-action-categories" ? (
        <SimpleResourceTab
          resource="corrective-action-categories"
          title="Corrective action categories"
          fields={[
            { key: "code", label: "Code" },
            { key: "name", label: "Name" },
            { key: "description", label: "Description", optional: true },
          ]}
          columns={["code", "name", "description"]}
        />
      ) : null}

      {tab === "temperature-profiles" ? (
        <SimpleResourceTab
          resource="temperature-profiles"
          title="Temperature profiles"
          fields={[
            { key: "code", label: "Code" },
            { key: "name", label: "Name" },
            { key: "minCelsius", label: "Min °C", numeric: true },
            { key: "maxCelsius", label: "Max °C", numeric: true },
          ]}
          columns={["code", "name", "minCelsius", "maxCelsius"]}
        />
      ) : null}

      {tab === "priorities" ? <PrioritiesTab /> : null}
      {tab === "loading-decision-policies" ? <LoadingDecisionPoliciesTab /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic code/name style resource tab (departments, shifts, failure reasons,
// corrective action categories, temperature profiles).
// ---------------------------------------------------------------------------

type FieldConfig = { key: string; label: string; optional?: boolean; numeric?: boolean };

function SimpleResourceTab({
  resource,
  title,
  fields,
  columns,
}: {
  resource: MasterDataResource;
  title: string;
  fields: FieldConfig[];
  columns: string[];
}) {
  type ListState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; rows: MasterDataRow[] };

  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [form, setForm] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setListState({ status: "loading" });
    fetchMasterData(resource)
      .then((rows) => setListState({ status: "ready", rows }))
      .catch((error: unknown) => {
        const messageText = error instanceof AdminApiError ? error.message : `Failed to load ${title.toLowerCase()}.`;
        setListState({ status: "error", message: messageText });
      });
  }, [resource, title]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const body: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = form[field.key]?.trim() ?? "";
        if (!raw) {
          if (!field.optional) continue;
          continue;
        }
        body[field.key] = field.numeric ? Number(raw) : raw;
      }
      await createMasterData(resource, body);
      setForm({});
      reload();
    } catch (error) {
      setCreateError(error instanceof AdminApiError ? error.message : `Failed to create ${title.toLowerCase()}.`);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(row: MasterDataRow) {
    setActionError(null);
    setMessage(null);
    try {
      await setMasterDataActive(resource, row.id, !row.isActive);
      setMessage(`${row.code} ${row.isActive ? "deactivated" : "activated"}.`);
      reload();
    } catch (error) {
      setActionError(error instanceof AdminApiError ? error.message : "Action failed.");
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
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
          Add {title.toLowerCase()}
        </h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {fields.map((field) => (
              <Input
                key={field.key}
                label={field.label}
                required={!field.optional}
                type={field.numeric ? "number" : "text"}
                step={field.numeric ? "0.1" : undefined}
                value={form[field.key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
              />
            ))}
          </div>
          {createError ? (
            <Alert tone="danger" title="Could not create">
              {createError}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" loading={creating}>
              Add
            </Button>
          </div>
        </form>
      </Card>

      {listState.status === "loading" ? <LoadingState message="Loading…" /> : null}
      {listState.status === "error" ? (
        <Alert tone="danger" title="Could not load">
          {listState.message}
        </Alert>
      ) : null}
      {listState.status === "ready" && listState.rows.length === 0 ? (
        <EmptyState title="No rows yet" description="Add the first row above." />
      ) : null}
      {listState.status === "ready" && listState.rows.length > 0 ? (
        <Card padding="lg">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col} style={{ textAlign: "left", padding: "0.5rem" }}>
                      {col}
                    </th>
                  ))}
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listState.rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--nelna-border)" }}>
                    {columns.map((col) => (
                      <td key={col} style={{ padding: "0.5rem" }}>
                        {String((row as unknown as Record<string, unknown>)[col] ?? "—")}
                      </td>
                    ))}
                    <td style={{ padding: "0.5rem" }}>
                      <Badge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <Button variant={row.isActive ? "danger" : "secondary"} onClick={() => handleToggleActive(row)}>
                        {row.isActive ? "Deactivate" : "Activate"}
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

// ---------------------------------------------------------------------------
// Sections — need a department selector
// ---------------------------------------------------------------------------

function SectionsTab() {
  type ListState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; rows: MasterDataRow[] };

  const [departments, setDepartments] = useState<MasterDataRow[]>([]);
  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [form, setForm] = useState({ code: "", name: "", departmentId: "", description: "" });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setListState({ status: "loading" });
    Promise.all([fetchMasterData("sections"), fetchMasterData("departments")])
      .then(([sections, depts]) => {
        setListState({ status: "ready", rows: sections });
        setDepartments(depts);
      })
      .catch((error: unknown) => {
        const messageText = error instanceof AdminApiError ? error.message : "Failed to load sections.";
        setListState({ status: "error", message: messageText });
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function departmentName(id?: string) {
    return departments.find((d) => d.id === id)?.name ?? id ?? "—";
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createMasterData("sections", {
        code: form.code.trim(),
        name: form.name.trim(),
        departmentId: form.departmentId,
        description: form.description.trim() || undefined,
      });
      setForm({ code: "", name: "", departmentId: "", description: "" });
      reload();
    } catch (error) {
      setCreateError(error instanceof AdminApiError ? error.message : "Failed to create section.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(row: MasterDataRow) {
    setActionError(null);
    setMessage(null);
    try {
      await setMasterDataActive("sections", row.id, !row.isActive);
      setMessage(`${row.code} ${row.isActive ? "deactivated" : "activated"}.`);
      reload();
    } catch (error) {
      setActionError(error instanceof AdminApiError ? error.message : "Action failed.");
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
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
          Add section
        </h2>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Input label="Code" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <Input label="Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Select
              label="Department"
              required
              placeholder="Select a department"
              options={departments.map((d) => ({ value: d.id, label: d.name ?? d.code }))}
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
            />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          {createError ? (
            <Alert tone="danger" title="Could not create section">
              {createError}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" loading={creating}>
              Add
            </Button>
          </div>
        </form>
      </Card>

      {listState.status === "loading" ? <LoadingState message="Loading sections…" /> : null}
      {listState.status === "error" ? (
        <Alert tone="danger" title="Could not load sections">
          {listState.message}
        </Alert>
      ) : null}
      {listState.status === "ready" && listState.rows.length === 0 ? (
        <EmptyState title="No sections yet" description="Add the first section above." />
      ) : null}
      {listState.status === "ready" && listState.rows.length > 0 ? (
        <Card padding="lg">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Code</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Department</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listState.rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--nelna-border)" }}>
                    <td style={{ padding: "0.5rem" }}>{row.code}</td>
                    <td style={{ padding: "0.5rem" }}>{row.name}</td>
                    <td style={{ padding: "0.5rem" }}>{departmentName(row.departmentId)}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <Badge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <Button variant={row.isActive ? "danger" : "secondary"} onClick={() => handleToggleActive(row)}>
                        {row.isActive ? "Deactivate" : "Activate"}
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

// ---------------------------------------------------------------------------
// Priorities — static read-only list
// ---------------------------------------------------------------------------

function PrioritiesTab() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: Array<{ value: string; label: string }> }
  >({ status: "loading" });

  useEffect(() => {
    fetchPriorities()
      .then((items) => setState({ status: "ready", items }))
      .catch((error: unknown) => {
        const message = error instanceof AdminApiError ? error.message : "Failed to load priorities.";
        setState({ status: "error", message });
      });
  }, []);

  if (state.status === "loading") return <LoadingState message="Loading priorities…" />;
  if (state.status === "error") {
    return (
      <Alert tone="danger" title="Could not load priorities">
        {state.message}
      </Alert>
    );
  }

  return (
    <Card>
      <h2 className="text-lg text-nelna-primary-dark" style={{ fontFamily: "var(--nelna-font-display)" }}>
        Priorities
      </h2>
      <p style={{ color: "var(--nelna-text-secondary)", marginTop: "0.25rem" }}>
        Fixed system enum values — not editable here.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
        {state.items.map((item) => (
          <Badge key={item.value} tone="neutral">
            {item.label}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading decision policies — admin-supplied JSON config, stored as-is
// ---------------------------------------------------------------------------

function LoadingDecisionPoliciesTab() {
  const [listState, setListState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; rows: LoadingDecisionPolicyRow[] }
  >({ status: "loading" });
  const [form, setForm] = useState({ key: "", description: "", config: "{}" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(() => {
    setListState({ status: "loading" });
    fetchLoadingDecisionPolicies()
      .then((rows) => setListState({ status: "ready", rows }))
      .catch((error: unknown) => {
        const messageText = error instanceof AdminApiError ? error.message : "Failed to load policies.";
        setListState({ status: "error", message: messageText });
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      let config: Record<string, unknown>;
      try {
        config = JSON.parse(form.config || "{}");
      } catch {
        throw new Error("Config must be valid JSON.");
      }
      await upsertLoadingDecisionPolicy(form.key.trim(), {
        description: form.description.trim() || undefined,
        config,
      });
      setMessage(`Policy "${form.key}" saved.`);
      setForm({ key: "", description: "", config: "{}" });
      reload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <Alert tone="information" title="Admin-supplied only">
        This system does not invent or pre-fill Nelna&apos;s loading decision policy content — whatever you post here
        is stored and returned as-is.
      </Alert>

      {message ? (
        <Alert tone="success" title="Done">
          {message}
        </Alert>
      ) : null}

      <Card>
        <h2 className="text-lg text-nelna-primary-dark" style={{ fontFamily: "var(--nelna-font-display)" }}>
          Create or replace a policy
        </h2>
        <form onSubmit={handleSave} style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Input label="Key" required value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <Textarea
            label="Config (JSON)"
            rows={6}
            value={form.config}
            onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
          />
          {saveError ? (
            <Alert tone="danger" title="Could not save policy">
              {saveError}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" loading={saving}>
              Save policy
            </Button>
          </div>
        </form>
      </Card>

      {listState.status === "loading" ? <LoadingState message="Loading policies…" /> : null}
      {listState.status === "error" ? (
        <Alert tone="danger" title="Could not load policies">
          {listState.message}
        </Alert>
      ) : null}
      {listState.status === "ready" && listState.rows.length === 0 ? (
        <EmptyState title="No policies yet" description="Create the first policy above." />
      ) : null}
      {listState.status === "ready" && listState.rows.length > 0 ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {listState.rows.map((row) => (
            <Card key={row.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>{row.key}</h3>
                <Badge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
              </div>
              {row.description ? (
                <p style={{ color: "var(--nelna-text-secondary)", marginTop: "0.25rem" }}>{row.description}</p>
              ) : null}
              <pre
                style={{
                  marginTop: "0.5rem",
                  background: "var(--nelna-surface-muted)",
                  padding: "0.75rem",
                  borderRadius: "var(--nelna-radius)",
                  overflowX: "auto",
                  fontSize: "0.85rem",
                }}
              >
                {JSON.stringify(row.config, null, 2)}
              </pre>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
