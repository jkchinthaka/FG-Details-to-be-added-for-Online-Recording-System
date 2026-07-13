import type { Metadata } from "next";
import { USER_ROLE_LABELS } from "@nelna/shared";
import { Card, PageHeader } from "@nelna/ui";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        description="Sign-in, roles and preferences arrive with the authentication phase."
      />
      <Card>
        <p className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          Placeholder profile — no authenticated session yet. Expected role for
          factory-floor operators:
        </p>
        <p className="mt-2 text-lg font-semibold text-nelna-primary-dark">
          {USER_ROLE_LABELS.FG_OPERATOR}
        </p>
      </Card>
    </div>
  );
}
