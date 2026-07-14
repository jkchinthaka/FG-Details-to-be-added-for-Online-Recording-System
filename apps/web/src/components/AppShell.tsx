"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type SVGProps } from "react";
import { Drawer, IconButton, LoadingState, ToastProvider, useToast } from "@nelna/ui";
import { USER_ROLE_LABELS } from "@nelna/shared";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";
import { filterNavItemsByRole } from "@/lib/auth/nav-config";
import { buildLoginRedirectUrl } from "@/lib/auth/session";
import { SessionExpiredDialog } from "@/components/SessionExpiredDialog";
import { OfflineStatusBar } from "@/components/OfflineStatusBar";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

type NavItem = {
  href: string;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/tasks", label: "Home", icon: HomeIcon },
  { href: "/records/new", label: "New Record", icon: NewRecordIcon },
  { href: "/records", label: "Records", icon: RecordsIcon },
  { href: "/records/pending-check", label: "To Check", icon: RecordsIcon },
  { href: "/records/pending-verification", label: "To Verify", icon: RecordsIcon },
  { href: "/corrective-actions", label: "Corrective Actions", icon: CorrectiveActionIcon },
  { href: "/reports", label: "Reports", icon: ReportsIcon },
  { href: "/admin", label: "Administration", icon: AdminIcon },
  { href: "/profile", label: "Profile", icon: ProfileIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const LOGIN_PATH = "/login";
const CHROMELESS_PATHS = new Set(["/login", "/unauthorized", "/account-inactive", "/offline"]);

/** Responsive application shell: bottom nav on mobile, sidebar from tablet up. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ServiceWorkerRegistrar />
        <ShellLayout>{children}</ShellLayout>
      </ToastProvider>
    </AuthProvider>
  );
}

function ShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (CHROMELESS_PATHS.has(pathname)) {
    return <div className="nelna-app-shell min-h-dvh">{children}</div>;
  }

  return <AuthenticatedShell pathname={pathname}>{children}</AuthenticatedShell>;
}

function AuthenticatedShell({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const router = useRouter();
  const auth = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (auth.status === "inactive") {
      router.replace("/account-inactive");
      return;
    }
    if (auth.status === "unauthenticated" && !auth.sessionExpiredNotice) {
      router.replace(buildLoginRedirectUrl(pathname, "session-expired"));
    }
  }, [auth.status, auth.sessionExpiredNotice, pathname, router]);

  useEffect(() => {
    if (auth.status === "authenticated" && !auth.canOpenPath(pathname)) {
      router.replace(`/unauthorized?from=${encodeURIComponent(pathname)}`);
    }
  }, [auth, pathname, router]);

  if (auth.status !== "authenticated") {
    return (
      <div className="nelna-app-shell flex min-h-dvh items-center justify-center">
        <LoadingState message="Checking your session…" />
        <SessionExpiredDialog
          open={auth.sessionExpiredNotice}
          onSignIn={() => {
            auth.clearSessionExpiredNotice();
            router.replace(buildLoginRedirectUrl(pathname, "session-expired"));
          }}
        />
      </div>
    );
  }

  const roles = auth.user?.roles ?? [];
  const visibleNavItems = filterNavItemsByRole(NAV_ITEMS, roles);
  const primaryNavItems = visibleNavItems.slice(0, 4);
  const moreNavItems = visibleNavItems.slice(4);

  return (
    <div className="nelna-app-shell flex min-h-dvh flex-col">
      <TopHeader />
      <div className="flex flex-1">
        <Sidebar pathname={pathname} items={visibleNavItems} />
        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 lg:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <OfflineStatusBar />
            {children}
          </div>
        </main>
      </div>
      <BottomNav
        pathname={pathname}
        items={primaryNavItems}
        hasMore={moreNavItems.length > 0}
        onMore={() => setMoreOpen(true)}
      />
      <Drawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        side="bottom"
      >
        <ul className="grid gap-1">
          {moreNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className="nelna-sidebar-link nelna-focusable"
              >
                <item.icon width={22} height={22} aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Drawer>
      <SessionExpiredDialog
        open={auth.sessionExpiredNotice}
        onSignIn={() => {
          auth.clearSessionExpiredNotice();
          router.replace(buildLoginRedirectUrl(pathname, "session-expired"));
        }}
      />
    </div>
  );
}

function TopHeader() {
  const { showToast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await auth.logout();
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
      router.replace(LOGIN_PATH);
    }
  }

  const primaryRole = auth.user?.roles[0];

  return (
    <header className="nelna-topbar sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-9 w-9 shrink-0 rounded-full"
            style={{
              background:
                "linear-gradient(145deg, var(--nelna-primary-light), var(--nelna-primary-active))",
              boxShadow: "inset 0 0 0 3px var(--nelna-gold)",
            }}
          />
          <span className="leading-tight">
            <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-nelna-primary">
              Nelna Farm · FG
            </span>
            <span
              className="block text-lg text-nelna-primary-dark"
              style={{ fontFamily: "var(--nelna-font-display)" }}
            >
              Digital Recording
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <IconButton
            icon={<BellIcon width={22} height={22} aria-hidden />}
            label="Notifications"
            onClick={() =>
              showToast({
                tone: "information",
                title: "Notifications",
                description: "The notification centre arrives in a later phase.",
              })
            }
          />
          <div ref={menuRef} className="relative">
            <IconButton
              icon={<ProfileIcon width={22} height={22} aria-hidden />}
              label="Account menu"
              variant={menuOpen ? "solid" : "ghost"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            />
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] w-60 rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white p-2"
                style={{ boxShadow: "var(--nelna-shadow-md)" }}
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-bold text-nelna-primary-dark">
                    {auth.user?.fullName ?? "Signed in"}
                  </p>
                  {primaryRole ? (
                    <p className="truncate text-xs" style={{ color: "var(--nelna-text-secondary)" }}>
                      {USER_ROLE_LABELS[primaryRole]}
                    </p>
                  ) : null}
                </div>
                <div className="my-1 border-t border-[var(--nelna-border)]" />
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center rounded-[var(--nelna-radius-sm)] px-3 text-sm font-semibold text-nelna-primary-dark hover:bg-[var(--nelna-surface-muted)]"
                >
                  Profile
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex min-h-11 w-full items-center rounded-[var(--nelna-radius-sm)] px-3 text-left text-sm font-semibold hover:bg-[var(--nelna-surface-muted)] disabled:opacity-60"
                  style={{ color: "var(--nelna-danger)" }}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ pathname, items }: { pathname: string; items: NavItem[] }) {
  return (
    <aside className="hidden shrink-0 border-r border-[var(--nelna-border)] bg-white md:flex md:w-20 md:flex-col md:gap-1 md:p-3 lg:w-64 lg:p-4">
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="nelna-sidebar-link nelna-focusable justify-center lg:justify-start"
            >
              <item.icon width={22} height={22} aria-hidden />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function BottomNav({
  pathname,
  items,
  hasMore,
  onMore,
}: {
  pathname: string;
  items: NavItem[];
  hasMore: boolean;
  onMore: () => void;
}) {
  return (
    <nav
      aria-label="Primary"
      className="nelna-bottom-nav fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className={hasMore ? "grid grid-cols-5" : "grid" } style={hasMore ? undefined : { gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="nelna-bottom-nav-link nelna-focusable"
              >
                <item.icon width={20} height={20} aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        {hasMore ? (
          <li>
            <button
              type="button"
              onClick={onMore}
              aria-label="More navigation options"
              className="nelna-bottom-nav-link nelna-focusable w-full"
            >
              <MoreIcon width={20} height={20} aria-hidden />
              <span>More</span>
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/* ---- Icons kept local and minimal: no external icon dependency ---- */

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1H9v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5h2.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function NewRecordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function RecordsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h3.7l1.3 2h7A2 2 0 0 1 19.5 10.5v7A2 2 0 0 1 17.5 19.5h-12a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function CorrectiveActionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 16.5h.01" />
    </svg>
  );
}

function ReportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 19.5V10M12 19.5V4.5M19 19.5V13.5" />
      <path d="M3.5 19.5h17" />
    </svg>
  );
}

function AdminIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.4 7.4 0 0 0 0-3l1.9-1.3-1.6-2.8-2.2.7a7.6 7.6 0 0 0-2.6-1.5L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2.6 1.5l-2.2-.7-1.6 2.8L4.6 10.5a7.4 7.4 0 0 0 0 3l-1.9 1.3 1.6 2.8 2.2-.7a7.6 7.6 0 0 0 2.6 1.5l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2.6-1.5l2.2.7 1.6-2.8z" />
    </svg>
  );
}

function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
