import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@nelna/ui";

export const metadata: Metadata = {
  title: "Administration",
};

type AdminLink = { href: string; title: string; description: string };

const ADMIN_LINKS: AdminLink[] = [
  {
    href: "/admin/users",
    title: "Users",
    description:
      "Create, activate/deactivate, assign departments and roles, reset passwords.",
  },
  {
    href: "/admin/vehicles",
    title: "Vehicles",
    description: "Register freezer trucks, set QR identifiers, view inspection history.",
  },
  {
    href: "/admin/drivers",
    title: "Drivers",
    description: "Manage driver records and license numbers.",
  },
  {
    href: "/admin/transporters",
    title: "Transporters",
    description: "Manage transporter companies used across the fleet.",
  },
  {
    href: "/admin/master-data",
    title: "Master data",
    description:
      "Departments, sections, shifts, failure reasons, corrective action categories, temperature profiles, loading decision policies.",
  },
  {
    href: "/admin/templates/preview",
    title: "Checklist templates",
    description: "Preview NMS/PPU/CL checklist templates — draft or published.",
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System Administrator"
        title="Administration"
        description="Manage users, fleet master data and checklist templates."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {ADMIN_LINKS.map((link) => (
          <Card key={link.href}>
            <h2
              className="text-nelna-primary-dark text-lg"
              style={{ fontFamily: "var(--nelna-font-display)" }}
            >
              {link.title}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
              {link.description}
            </p>
            <Link
              href={link.href}
              className="text-nelna-primary mt-3 inline-block font-semibold"
            >
              Open {link.title.toLowerCase()} →
            </Link>
          </Card>
        ))}
      </div>
      <Card muted>
        <h2
          className="text-nelna-primary-dark text-lg"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Developer references
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          <Link href="/system-status" className="text-nelna-primary font-semibold">
            System status
          </Link>{" "}
          ·{" "}
          <Link href="/about" className="text-nelna-primary font-semibold">
            About
          </Link>
        </p>
      </Card>
    </div>
  );
}
