"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changePasswordSchema, PASSWORD_MIN_LENGTH } from "@nelna/shared";
import { Alert, Button, Input } from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError, changePassword } from "@/lib/auth/api";

export function ChangePasswordForm() {
  const router = useRouter();
  const auth = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
    } else if (auth.status === "authenticated" && !auth.user?.mustChangePassword) {
      router.replace("/tasks");
    }
  }, [auth.status, auth.user?.mustChangePassword, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await changePassword(parsed.data);
      await auth.refetch();
      if (!user.mustChangePassword) {
        router.replace("/tasks");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.status === "loading") {
    return <p className="p-6 text-center text-sm">Loading…</p>;
  }

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4 py-10"
      style={{ background: "var(--nelna-cream)" }}
    >
      <div className="w-full max-w-sm">
        <h1
          className="text-nelna-primary-dark mb-2 text-center text-2xl"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Set a new password
        </h1>
        <p
          className="mb-6 text-center text-sm"
          style={{ color: "var(--nelna-text-secondary)" }}
        >
          Your administrator issued a temporary password. Choose a new password (minimum{" "}
          {PASSWORD_MIN_LENGTH} characters) before continuing.
        </p>

        <form
          onSubmit={handleSubmit}
          className="rounded-[var(--nelna-radius-lg)] border border-[var(--nelna-border)] bg-white p-5 sm:p-6"
          style={{ boxShadow: "var(--nelna-shadow-md)" }}
          noValidate
        >
          <div className="space-y-4">
            {error ? (
              <Alert tone="danger" title="Could not update password">
                {error}
              </Alert>
            ) : null}

            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={submitting}
              required
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              minLength={PASSWORD_MIN_LENGTH}
              required
            />

            <Button type="submit" size="lg" fullWidth loading={submitting}>
              Update password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
