"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CORRECTIVE_ACTION_STATUSES,
  CORRECTIVE_ACTION_STATUS_LABELS,
  type CorrectiveActionStatus,
  type CorrectiveActionSummary,
} from "@nelna/shared";
import { Alert, Badge, Button, Card, EmptyState, LoadingState, Select } from "@nelna/ui";
import {
  CorrectiveActionApiError,
  listCorrectiveActions,
} from "@/lib/corrective-actions/api";
import { useAuth } from "@/lib/auth/auth-context";

export function CorrectiveActionsWorkspace() {
  const { user } = useAuth();
  const canManage = user?.permissions.includes("corrective_actions:manage") ?? false;
  const [status, setStatus] = useState<CorrectiveActionStatus | "">("");
  const [items, setItems] = useState<CorrectiveActionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCorrectiveActions({
        status: status || undefined,
        page: 1,
        pageSize: 50,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof CorrectiveActionApiError
          ? err.message
          : "Unable to load corrective actions",
      );
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState message="Loading corrective actions…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Status"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as CorrectiveActionStatus | "")
          }
          options={[
            { value: "", label: "All statuses" },
            ...CORRECTIVE_ACTION_STATUSES.map((value) => ({
              value,
              label: CORRECTIVE_ACTION_STATUS_LABELS[value],
            })),
          ]}
        />
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {!error && items.length === 0 ? (
        <EmptyState
          title="No corrective actions found"
          description={
            canManage
              ? "Failures that require follow-up will appear here when operators submit inspected records."
              : "No corrective actions match the current filter."
          }
        />
      ) : null}

      {items.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted)]">
            {total} corrective action{total === 1 ? "" : "s"}
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/corrective-actions/${item.id}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-[var(--color-surface-muted)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">{item.title}</p>
                    <p className="line-clamp-2 text-sm text-[var(--color-muted)]">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{CORRECTIVE_ACTION_STATUS_LABELS[item.status]}</Badge>
                    <Badge tone="warning">{item.priority}</Badge>
                    {item.dueDate ? (
                      <span className="text-xs text-[var(--color-muted)]">
                        Due {item.dueDate}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
