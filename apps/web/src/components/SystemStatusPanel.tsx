"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  service: string;
  product: string;
  version: string;
  environment: string;
  timestamp: string;
  checks: { api: string };
};

type LoadState =
  | { phase: "loading" }
  | { phase: "ok"; data: HealthResponse }
  | { phase: "error"; message: string };

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export function SystemStatusPanel() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  async function load() {
    setState({ phase: "loading" });
    try {
      const response = await fetch(`${apiBase}/health`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Health check failed (${response.status})`);
      }
      const data = (await response.json()) as HealthResponse;
      setState({ phase: "ok", data });
    } catch (error) {
      setState({
        phase: "error",
        message:
          error instanceof Error ? error.message : "Unable to reach the Nelna FG API",
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section
      className="rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white p-4"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            className="text-nelna-primary-dark text-xl"
            style={{ fontFamily: "var(--nelna-font-display)" }}
          >
            System status
          </h2>
          <p className="mt-1 text-sm text-[var(--nelna-text-muted)]">
            Development health check against {apiBase}/health
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-nelna-primary-dark min-h-12 rounded-[var(--nelna-radius)] border-2 border-[var(--nelna-border)] px-4 text-sm font-semibold"
        >
          Refresh
        </button>
      </div>

      {state.phase === "loading" ? (
        <p className="mt-4 text-sm text-[var(--nelna-text-muted)]">Checking API…</p>
      ) : null}

      {state.phase === "error" ? (
        <div className="mt-4 rounded-[10px] border border-[var(--nelna-danger)] bg-[var(--nelna-danger-bg)] p-3 text-sm text-[var(--nelna-danger)]">
          <p className="font-semibold">API unreachable</p>
          <p className="mt-1">{state.message}</p>
          <p className="mt-2 text-[var(--nelna-text-muted)]">
            Start the API with `pnpm dev:api`, then refresh.
          </p>
        </div>
      ) : null}

      {state.phase === "ok" ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <StatusItem label="Status" value={state.data.status} emphasize />
          <StatusItem label="Service" value={state.data.service} />
          <StatusItem label="Version" value={state.data.version} />
          <StatusItem label="Environment" value={state.data.environment} />
          <StatusItem label="API check" value={state.data.checks.api} />
          <StatusItem
            label="Checked at"
            value={new Date(state.data.timestamp).toLocaleString()}
          />
          <div className="sm:col-span-2">
            <StatusItem label="Product" value={state.data.product} />
          </div>
        </dl>
      ) : null}
    </section>
  );
}

function StatusItem({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <dt className="text-[var(--nelna-text-muted)]">{label}</dt>
      <dd
        className="font-semibold capitalize"
        style={{
          color: emphasize ? "var(--nelna-primary)" : "var(--nelna-primary-dark)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}
