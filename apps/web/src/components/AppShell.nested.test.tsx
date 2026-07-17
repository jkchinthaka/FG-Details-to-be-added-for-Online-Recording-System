import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { CurrentUser } from "@nelna/shared";
import { AppShell } from "@/components/AppShell";
import * as authContext from "@/lib/auth/auth-context";

const APP_SRC = join(__dirname, "..");
const APP_DIR = join(APP_SRC, "app");

function walkTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTsxFiles(full));
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const navigationMocks = vi.hoisted(() => ({
  pathname: "/reports",
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
  useRouter: () => ({
    replace: navigationMocks.replace,
    push: navigationMocks.push,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ServiceWorkerRegistrar", () => ({
  ServiceWorkerRegistrar: () => null,
}));

vi.mock("@/components/OfflineStatusBar", () => ({
  OfflineStatusBar: () => null,
}));

vi.mock("@/components/SessionExpiredDialog", () => ({
  SessionExpiredDialog: () => null,
}));

function mockAuthenticatedUser(overrides: Partial<CurrentUser> = {}) {
  const user: CurrentUser = {
    id: "u1",
    employeeCode: "E1",
    username: "fg.supervisor01",
    fullName: "Shell Tester",
    email: null,
    status: "ACTIVE",
    mustChangePassword: false,
    roles: ["FG_SUPERVISOR", "SYSTEM_ADMINISTRATOR"],
    permissions: ["reports:read", "records:read", "records:check", "records:verify"],
    lastLoginAt: null,
    ...overrides,
  };
  vi.spyOn(authContext, "useAuth").mockReturnValue({
    status: "authenticated",
    user,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
    applyUser: vi.fn(),
    sessionExpiredNotice: false,
    clearSessionExpiredNotice: vi.fn(),
    canOpenPath: () => true,
  });
}

function assertSingleApplicationChrome(container: HTMLElement) {
  expect(container.querySelectorAll(".nelna-app-shell")).toHaveLength(1);
  expect(container.querySelectorAll("header.nelna-topbar")).toHaveLength(1);
  expect(container.querySelectorAll("aside")).toHaveLength(1);
  expect(container.querySelectorAll("nav.nelna-bottom-nav")).toHaveLength(1);
  // Sidebar + bottom nav both use aria-label="Primary" — exactly two, not four.
  expect(container.querySelectorAll('nav[aria-label="Primary"]')).toHaveLength(2);
}

describe("AppShell ownership (no nested shells)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps AppShell ownership in root layout only (no page-level wrappers)", () => {
    const offenders: string[] = [];
    for (const file of walkTsxFiles(APP_DIR)) {
      const rel = relative(APP_SRC, file).replace(/\\/g, "/");
      if (rel === "app/layout.tsx") continue;
      const source = readFileSync(file, "utf8");
      if (
        /from\s+["']@\/components\/AppShell["']/.test(source) ||
        /<AppShell[\s>]/.test(source)
      ) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("renders /reports content with exactly one application chrome layer", () => {
    navigationMocks.pathname = "/reports";
    mockAuthenticatedUser();
    const { container } = render(
      <AppShell>
        <h1>Reports</h1>
      </AppShell>,
    );
    assertSingleApplicationChrome(container);
    expect(screen.getAllByRole("heading", { name: /^Reports$/i })).toHaveLength(1);
  });

  it("fails the shell-count contract when AppShell is nested (regression guard)", () => {
    navigationMocks.pathname = "/reports";
    mockAuthenticatedUser();
    const { container } = render(
      <AppShell>
        <AppShell>
          <h1>Reports</h1>
        </AppShell>
      </AppShell>,
    );
    expect(container.querySelectorAll(".nelna-app-shell").length).toBeGreaterThan(1);
    expect(container.querySelectorAll("header.nelna-topbar").length).toBeGreaterThan(1);
  });

  const protectedRoutes = [
    "/tasks",
    "/records",
    "/records/new",
    "/records/cleaning",
    "/records/freezer-truck",
    "/records/pending-check",
    "/records/pending-verification",
    "/corrective-actions",
    "/reports",
    "/profile",
    "/admin",
    "/admin/users",
    "/admin/master-data",
    "/admin/vehicles",
    "/admin/drivers",
    "/admin/transporters",
    "/admin/templates/preview",
    "/system-status",
  ];

  it.each(protectedRoutes)("single shell chrome for protected route %s", (pathname) => {
    navigationMocks.pathname = pathname;
    mockAuthenticatedUser();
    const { container } = render(
      <AppShell>
        <p>Page body for {pathname}</p>
      </AppShell>,
    );
    assertSingleApplicationChrome(container);
    expect(within(container).getByText(`Page body for ${pathname}`)).toBeInTheDocument();
  });

  it("does not show the normal application sidebar on chromeless /login", () => {
    navigationMocks.pathname = "/login";
    mockAuthenticatedUser();
    const { container } = render(
      <AppShell>
        <h1>Sign in</h1>
      </AppShell>,
    );
    expect(container.querySelectorAll("aside")).toHaveLength(0);
    expect(container.querySelectorAll("nav.nelna-bottom-nav")).toHaveLength(0);
    expect(container.querySelectorAll('nav[aria-label="Primary"]')).toHaveLength(0);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("does not show normal app nav on chromeless /change-password", () => {
    navigationMocks.pathname = "/change-password";
    mockAuthenticatedUser({ mustChangePassword: true });
    const { container } = render(
      <AppShell>
        <h1>Create a new password</h1>
      </AppShell>,
    );
    expect(container.querySelectorAll("aside")).toHaveLength(0);
    expect(container.querySelectorAll("nav.nelna-bottom-nav")).toHaveLength(0);
    expect(container.querySelectorAll('nav[aria-label="Primary"]')).toHaveLength(0);
    expect(
      screen.getByRole("heading", { name: /create a new password/i }),
    ).toBeInTheDocument();
  });

  it("uses restricted password chrome (no sidebar) when mustChangePassword on app routes", () => {
    navigationMocks.pathname = "/tasks";
    mockAuthenticatedUser({ mustChangePassword: true });
    const { container } = render(
      <AppShell>
        <h1>Blocked content</h1>
      </AppShell>,
    );
    expect(container.querySelectorAll("aside")).toHaveLength(0);
    expect(container.querySelectorAll("nav.nelna-bottom-nav")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
