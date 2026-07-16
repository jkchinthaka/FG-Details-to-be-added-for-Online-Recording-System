"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  changePasswordSchema,
  evaluatePasswordStrength,
  PASSWORD_MIN_LENGTH,
} from "@nelna/shared";
import { Alert, Button, FormErrorSummary, Input } from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError, changePassword } from "@/lib/auth/api";
import { postPasswordChangeLandingPath } from "@/lib/auth/middleware-logic";

export function ChangePasswordForm() {
  const router = useRouter();
  const auth = useAuth();
  const formId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const currentInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const strength = useMemo(
    () => evaluatePasswordStrength(newPassword, currentPassword),
    [newPassword, currentPassword],
  );

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
    } else if (auth.status === "authenticated" && auth.user && !auth.user.mustChangePassword) {
      router.replace(postPasswordChangeLandingPath(auth.user));
    }
  }, [auth.status, auth.user, router]);

  useEffect(() => {
    currentInputRef.current?.focus();
  }, []);

  function onKeyEvent(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState?.("CapsLock") ?? false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await auth.logout();
    } finally {
      setSigningOut(false);
      router.replace("/login");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFieldErrors([]);
    setStatusMessage("");

    if (newPassword !== confirmPassword) {
      const message = "New password and confirmation do not match.";
      setFieldErrors([message]);
      setStatusMessage(message);
      errorSummaryRef.current?.focus();
      return;
    }

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      setFieldErrors(messages);
      setStatusMessage(messages[0] ?? "Invalid password.");
      errorSummaryRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setStatusMessage("Updating password…");
    try {
      const user = await changePassword(parsed.data);
      auth.applyUser(user);
      void auth.refetch();
      setSuccess(true);
      setStatusMessage("Password updated successfully.");
      if (!user.mustChangePassword) {
        router.replace(postPasswordChangeLandingPath(user));
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not change password. Try again.";
      setFieldErrors([message]);
      setStatusMessage(message);
      errorSummaryRef.current?.focus();
      currentInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.status === "loading") {
    return <p className="p-6 text-center text-sm">Loading…</p>;
  }

  const displayName =
    auth.user?.fullName ||
    auth.user?.username ||
    auth.user?.employeeCode ||
    "your account";

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-8 sm:py-10"
      style={{ background: "var(--nelna-cream)" }}
    >
      <div className="w-full max-w-md" style={{ width: "min(100%, 28rem)" }}>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="nelna-focusable text-sm font-semibold underline disabled:opacity-60"
            style={{
              color: "var(--nelna-danger)",
              minHeight: "var(--nelna-touch-comfortable)",
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>

        <p
          className="mb-2 text-center text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--nelna-text-secondary)" }}
        >
          Step 1 of 1 — Secure your account
        </p>
        <h1
          className="text-nelna-primary-dark mb-2 text-center text-2xl"
          style={{ fontFamily: "var(--nelna-font-display)" }}
        >
          Create a new password
        </h1>
        <p
          className="mb-2 text-center text-sm"
          style={{ color: "var(--nelna-text-secondary)" }}
        >
          For your security, create a new password before using the system.
        </p>
        <p
          className="mb-6 text-center text-sm"
          style={{ color: "var(--nelna-text-secondary)" }}
        >
          Signed in as <strong style={{ color: "var(--nelna-text-primary)" }}>{displayName}</strong>
          {auth.user?.employeeCode ? (
            <>
              {" "}
              (<span className="font-mono text-xs">{auth.user.employeeCode}</span>)
            </>
          ) : null}
        </p>

        <div aria-live="polite" className="nelna-sr-only">
          {statusMessage}
        </div>

        <form
          id={formId}
          onSubmit={handleSubmit}
          className="rounded-[var(--nelna-radius-lg)] border border-[var(--nelna-border)] bg-white p-5 sm:p-6"
          style={{ boxShadow: "var(--nelna-shadow-md)" }}
          noValidate
        >
          <div className="space-y-4">
            {!success ? <FormErrorSummary ref={errorSummaryRef} errors={fieldErrors} /> : null}

            {success ? (
              <Alert tone="success" title="Password updated">
                Redirecting you to the application…
              </Alert>
            ) : null}

            <fieldset className="space-y-2 rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-[var(--nelna-surface-muted)] p-3">
              <legend className="px-1 text-sm font-semibold">Password requirements</legend>
              <ul className="space-y-1 text-sm" aria-label="Password requirements checklist">
                {strength.requirements.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-start gap-2"
                    style={{
                      color: req.met ? "var(--nelna-success)" : "var(--nelna-text-secondary)",
                    }}
                  >
                    <span aria-hidden="true">{req.met ? "✓" : "○"}</span>
                    <span>
                      {req.label}
                      <span className="nelna-sr-only">
                        {req.met ? " — met" : " — not yet met"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {newPassword.length > 0 ? (
                <p className="pt-1 text-sm" aria-live="polite">
                  Strength: <strong>{strength.label}</strong>
                </p>
              ) : null}
            </fieldset>

            {capsLockOn ? (
              <Alert tone="warning" title="Caps Lock is on">
                Check Caps Lock before entering your password.
              </Alert>
            ) : null}

            <PasswordField
              ref={currentInputRef}
              label="Current temporary password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggleShow={() => setShowCurrent((v) => !v)}
              disabled={submitting}
              onKeyEvent={onKeyEvent}
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
              disabled={submitting}
              minLength={PASSWORD_MIN_LENGTH}
              onKeyEvent={onKeyEvent}
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
              disabled={submitting}
              minLength={PASSWORD_MIN_LENGTH}
              onKeyEvent={onKeyEvent}
            />

            <Button type="submit" size="lg" fullWidth loading={submitting}>
              {submitting ? "Updating password…" : "Update password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  disabled?: boolean;
  autoComplete: string;
  minLength?: number;
  onKeyEvent: (event: KeyboardEvent<HTMLInputElement>) => void;
};

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      label,
      value,
      onChange,
      show,
      onToggleShow,
      disabled,
      autoComplete,
      minLength,
      onKeyEvent,
    },
    ref,
  ) {
    return (
      <div className="space-y-1">
        <Input
          ref={ref}
          label={label}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyEvent}
          onKeyUp={onKeyEvent}
          disabled={disabled}
          minLength={minLength}
          required
        />
        <button
          type="button"
          className="nelna-focusable text-sm font-medium underline"
          style={{
            color: "var(--nelna-primary)",
            minHeight: "var(--nelna-touch-comfortable)",
          }}
          onClick={onToggleShow}
          aria-pressed={show}
        >
          {show ? "Hide password" : "Show password"}
        </button>
      </div>
    );
  },
);
