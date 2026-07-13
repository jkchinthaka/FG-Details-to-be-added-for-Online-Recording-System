"use client";

import { useRouter } from "next/navigation";
import { USER_ROLE_LABELS } from "@nelna/shared";
import { Badge, Button, Card, LoadingState, PageHeader } from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";

export function ProfileView() {
  const router = useRouter();
  const auth = useAuth();

  if (auth.status !== "authenticated" || !auth.user) {
    return <LoadingState message="Loading your profile…" />;
  }

  const { user } = auth;

  async function handleSignOut() {
    await auth.logout();
    router.replace("/login");
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Your account" title="Profile" description="Your sign-in details, roles and session." />

      <Card>
        <h2
          className="text-lg text-nelna-primary-dark"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          {user.fullName}
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ProfileField label="Employee code" value={user.employeeCode} />
          <ProfileField label="Email" value={user.email ?? "—"} />
          <ProfileField
            label="Last signed in"
            value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "This session"}
          />
          <ProfileField label="Account status" value={user.status} />
        </dl>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-nelna-primary">Roles</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <Badge key={role} tone="primary">
                {USER_ROLE_LABELS[role]}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      <Card muted>
        <p className="text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
          Signing out ends this session on this device only.
        </p>
        <div className="mt-3">
          <Button variant="danger" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--nelna-text-muted)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-nelna-primary-dark">{value}</dd>
    </div>
  );
}
