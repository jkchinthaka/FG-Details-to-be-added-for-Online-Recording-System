"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NELNA_BRAND } from "@nelna/shared";
import { Alert, Button, Input } from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/auth/api";
import {
  loginFormStateForErrorCode,
  resolvePostLoginPath,
  type LoginFormState,
} from "@/lib/auth/session";
import { validateLogin, type LoginFieldErrors } from "@/lib/auth/validation";

const BANNER_COPY: Record<
  LoginFormState,
  { tone: "danger" | "warning"; title: string; message?: string } | null
> = {
  idle: null,
  submitting: null,
  "invalid-credentials": { tone: "danger", title: "Invalid email or password" },
  "account-inactive": { tone: "warning", title: "Account inactive" },
  "account-locked": { tone: "warning", title: "Account temporarily locked" },
  "session-expired": {
    tone: "warning",
    title: "Session expired",
    message: "Please sign in again to continue.",
  },
  "unknown-error": {
    tone: "danger",
    title: "Something went wrong",
    message: "Please try again.",
  },
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors | null>(null);
  const [formState, setFormState] = useState<LoginFormState>("idle");
  const [serverMessage, setServerMessage] = useState<string | undefined>();

  useEffect(() => {
    if (searchParams.get("reason") === "session-expired") {
      setFormState("session-expired");
    }
  }, [searchParams]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace(resolvePostLoginPath(searchParams.get("next")));
    }
  }, [auth.status, router, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateLogin({ email, password });
    setFieldErrors(errors);
    if (errors) {
      setFormState("idle");
      return;
    }

    setFormState("submitting");
    setServerMessage(undefined);

    try {
      await auth.login({ email: email.trim(), password });
      router.replace(resolvePostLoginPath(searchParams.get("next")));
    } catch (error) {
      if (error instanceof ApiError) {
        setFormState(loginFormStateForErrorCode(error.code));
        setServerMessage(error.message);
      } else {
        setFormState("unknown-error");
      }
    }
  }

  const banner = BANNER_COPY[formState];
  const isSubmitting = formState === "submitting";

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4 py-10"
      style={{ background: "var(--nelna-cream)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="mb-4 h-16 w-16 shrink-0 rounded-full"
            style={{
              background:
                "linear-gradient(145deg, var(--nelna-primary-light), var(--nelna-primary-active))",
              boxShadow: "inset 0 0 0 4px var(--nelna-gold)",
            }}
          />
          <p className="text-nelna-primary text-xs font-semibold uppercase tracking-[0.16em]">
            {NELNA_BRAND.name} Farm · FG
          </p>
          <h1
            className="text-nelna-primary-dark mt-1.5 text-[1.9rem] leading-tight"
            style={{ fontFamily: "var(--nelna-font-display)" }}
          >
            Digital Recording
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--nelna-text-secondary)" }}>
            Sign in to record and review Finished Goods checks.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[var(--nelna-radius-lg)] border border-[var(--nelna-border)] bg-white p-5 sm:p-6"
          style={{ boxShadow: "var(--nelna-shadow-md)" }}
          noValidate
        >
          <div className="space-y-4">
            {banner ? (
              <Alert tone={banner.tone} title={banner.title}>
                {serverMessage ?? banner.message}
              </Alert>
            ) : null}

            <Input
              label="Email"
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="you@example.local"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors?.email}
              disabled={isSubmitting}
              autoFocus
            />

            <div className="nelna-field">
              <label htmlFor="login-password" className="nelna-field-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors?.password)}
                  aria-describedby={
                    fieldErrors?.password ? "login-password-error" : undefined
                  }
                  className={[
                    "nelna-control",
                    "nelna-focusable",
                    fieldErrors?.password ? "nelna-control-invalid" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ paddingRight: "3.75rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((show) => !show)}
                  disabled={isSubmitting}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="nelna-focusable text-nelna-primary absolute right-1.5 top-1/2 flex h-9 w-11 -translate-y-1/2 items-center justify-center rounded-[var(--nelna-radius-sm)] text-sm font-semibold hover:bg-[var(--nelna-surface-muted)] disabled:opacity-50"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors?.password ? (
                <p id="login-password-error" role="alert" className="nelna-field-error">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
              Sign in
            </Button>
          </div>
        </form>

        <p
          className="mt-5 text-center text-xs"
          style={{ color: "var(--nelna-text-secondary)" }}
        >
          Locked out or need access? Contact your System Administrator.
        </p>
      </div>
    </div>
  );
}
