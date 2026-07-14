import Link from "next/link";
import type { UserRole } from "@nelna/shared";
import { Card } from "@nelna/ui";
import { isNavItemVisible } from "@/lib/auth/nav-config";

type QuickAction = {
  id: string;
  label: string;
  href: string;
  /** Reuses the nav's role map so quick actions never outrun what the destination page itself allows. */
  requiresNavHref: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "start-cleaning",
    label: "Start Daily Cleaning",
    href: "/records/cleaning",
    requiresNavHref: "/records/new",
  },
  {
    id: "inspect-freezer-truck",
    label: "Inspect Freezer Truck",
    href: "/records/freezer-truck",
    requiresNavHref: "/records/new",
  },
  {
    id: "view-my-records",
    label: "View My Records",
    href: "/records",
    requiresNavHref: "/records",
  },
];

export function QuickActionsSection({ roles }: { roles: UserRole[] }) {
  const visibleActions = QUICK_ACTIONS.filter((action) =>
    isNavItemVisible(action.requiresNavHref, roles),
  );
  if (visibleActions.length === 0) return null;

  return (
    <Card>
      <h2 className="text-nelna-primary text-sm font-bold uppercase tracking-wide">
        Quick actions
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {visibleActions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="nelna-focusable text-nelna-primary-dark flex min-h-12 items-center justify-center rounded-[var(--nelna-radius)] border-2 border-[var(--nelna-border)] px-4 text-center text-sm font-semibold hover:bg-[var(--nelna-surface-muted)]"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
