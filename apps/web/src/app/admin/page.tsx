import type { Metadata } from "next";
import Link from "next/link";
import { USER_ROLES, USER_ROLE_LABELS } from "@nelna/shared";
import { Badge, Card, PageHeader } from "@nelna/ui";

export const metadata: Metadata = {
  title: "Administration",
};

export default function AdminPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System Administrator"
        title="Administration"
        description="Users, roles, checklist templates and master data management land in later phases."
      />
      <Card>
        <h2
          className="text-lg text-nelna-primary-dark"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Planned system roles
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {USER_ROLES.map((role) => (
            <Badge key={role} tone="neutral">
              {USER_ROLE_LABELS[role]}
            </Badge>
          ))}
        </div>
      </Card>
      <Card>
        <h2
          className="text-lg text-nelna-primary-dark"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Checklist templates
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          Preview NMS/PPU/CL/24, NMS/PPU/CL/30 and future checklist templates — draft or published — through the
          dynamic checklist engine.
        </p>
        <Link
          href="/admin/templates/preview"
          className="mt-3 inline-block font-semibold text-nelna-primary"
        >
          Open template preview →
        </Link>
      </Card>
      <Card muted>
        <h2
          className="text-lg text-nelna-primary-dark"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Developer references
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          <Link href="/system-status" className="font-semibold text-nelna-primary">
            System status
          </Link>{" "}
          ·{" "}
          <Link href="/about" className="font-semibold text-nelna-primary">
            About
          </Link>
        </p>
      </Card>
    </div>
  );
}
