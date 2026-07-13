"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/system-status", label: "Status" },
  { href: "/records/cleaning", label: "Cleaning" },
  { href: "/about", label: "About" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-24 pt-4 sm:max-w-2xl sm:px-6 lg:max-w-3xl">
      <header className="mb-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-nelna-primary">
              Nelna Farm · Finished Goods
            </p>
            <h1
              className="mt-1 text-[1.65rem] leading-tight text-nelna-primary-dark sm:text-3xl"
              style={{ fontFamily: "var(--nelna-font-display)" }}
            >
              FG Digital Recording
            </h1>
          </div>
          <span
            aria-hidden
            className="mb-1 h-10 w-10 shrink-0 rounded-full"
            style={{
              background:
                "linear-gradient(145deg, var(--nelna-primary-light), var(--nelna-primary-dark))",
              boxShadow: "inset 0 0 0 3px var(--nelna-gold)",
            }}
          />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--nelna-border)] bg-white/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4 sm:max-w-2xl lg:max-w-3xl">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-14 flex-col items-center justify-center px-1 text-sm font-semibold"
                  style={{
                    color: active
                      ? "var(--nelna-primary)"
                      : "var(--nelna-text-muted)",
                    boxShadow: active
                      ? "inset 0 3px 0 var(--nelna-gold)"
                      : undefined,
                  }}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
