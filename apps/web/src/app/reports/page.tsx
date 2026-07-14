"use client";

import { useCallback, useEffect, useState } from "react";
import {
  REPORT_KIND_LABELS,
  type ReportKind,
  type ReportResult,
} from "@nelna/shared";
import { Button, Card, EmptyState, Input, LoadingState, Select } from "@nelna/ui";
import { AppShell } from "@/components/AppShell";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type KindOption = { kind: ReportKind; title: string };

async function apiJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export default function ReportsPage() {
  return (
    <AppShell>
      <ReportsWorkspace />
    </AppShell>
  );
}

function ReportsWorkspace() {
  const [kinds, setKinds] = useState<KindOption[]>([]);
  const [kind, setKind] = useState<ReportKind>("daily_record_completion");
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiJson<KindOption[]>("/reports/kinds")
      .then((list) => {
        setKinds(list);
        if (list[0]) setKind(list[0].kind);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ fromDate, toDate, page: "1", pageSize: "25" });
      const result = await apiJson<ReportResult>(`/reports/run/${encodeURIComponent(kind)}?${qs}`);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed");
      setReport(null);
    } finally {
      setBusy(false);
    }
  }, [fromDate, toDate, kind]);

  function downloadCsv() {
    const qs = new URLSearchParams({ fromDate, toDate });
    window.open(`${API_BASE_URL}/reports/run/${encodeURIComponent(kind)}/csv?${qs}`, "_blank");
  }

  if (loading) return <LoadingState message="Loading reports…" />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
      <header>
        <h1 className="font-display text-2xl text-[var(--color-brand-primary)]">Reports</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Operational compliance, queues, truck and corrective-action reports with CSV export. Official PDFs use
          electronic approval language — not cryptographic digital signatures.
        </p>
      </header>

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <Select
            label="Report"
            value={kind}
            onChange={(e) => setKind(e.target.value as ReportKind)}
            options={(kinds.length ? kinds : Object.entries(REPORT_KIND_LABELS).map(([k, title]) => ({ kind: k as ReportKind, title }))).map(
              (k) => ({ value: k.kind, label: k.title }),
            )}
          />
          <Input label="From date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="To date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="button" disabled={busy} onClick={() => void run()}>
              Run
            </Button>
            <Button type="button" variant="secondary" disabled={!report} onClick={downloadCsv}>
              CSV
            </Button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
      </Card>

      {!report ? (
        <EmptyState title="No report loaded" description="Choose a report and date range, then Run." />
      ) : (
        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{report.title}</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {report.totalRows} row(s) · page {report.page} · generated {report.generatedAt}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  {report.columns.map((col) => (
                    <th key={col} className="border-b px-2 py-1 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, idx) => (
                  <tr key={idx} className="odd:bg-[var(--color-brand-cream)]/40">
                    {report.columns.map((col) => (
                      <td key={col} className="border-b px-2 py-1 align-top">
                        {row[col] === null || row[col] === undefined ? "—" : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
