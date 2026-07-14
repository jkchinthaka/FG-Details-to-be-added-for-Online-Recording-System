import Link from "next/link";
import type { AdminShortcut } from "@nelna/shared";
import { Card } from "@nelna/ui";

/** Static System-Administrator shortcuts — no query needed, mirrors apps/api TasksService. */
export function AdminShortcutsSection({ shortcuts }: { shortcuts: AdminShortcut[] }) {
  if (shortcuts.length === 0) return null;

  return (
    <Card>
      <h2 className="text-nelna-primary text-sm font-bold uppercase tracking-wide">
        Admin shortcuts
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.id}
            href={shortcut.href}
            className="nelna-focusable rounded-[var(--nelna-radius-sm)] border border-[var(--nelna-border)] px-3 py-2.5 hover:bg-[var(--nelna-surface-muted)]"
          >
            <p className="text-nelna-primary-dark text-sm font-semibold">
              {shortcut.label}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--nelna-text-muted)" }}>
              {shortcut.description}
            </p>
          </Link>
        ))}
      </div>
    </Card>
  );
}
