"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CurrentUser, LoginInput } from "@nelna/shared";
import { ApiError, fetchCurrentUser, login as apiLogin, logout as apiLogout, refreshSession } from "./api";
import { isSessionExpiredCode } from "./session";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  status: AuthStatus;
  user: CurrentUser | null;
  login: (input: LoginInput) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  /** Re-checks the current session against the API (e.g. after a 401 elsewhere in the app). */
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      setStatus("authenticated");
      return;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "UNKNOWN";
      if (isSessionExpiredCode(code)) {
        // Access token expired but a refresh token may still be valid —
        // attempt one silent refresh before giving up on the session.
        try {
          const refreshedUser = await refreshSession();
          setUser(refreshedUser);
          setStatus("authenticated");
          return;
        } catch {
          // fall through to unauthenticated below
        }
      }
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const login = useCallback(async (input: LoginInput) => {
    const currentUser = await apiLogin(input);
    setUser(currentUser);
    setStatus("authenticated");
    return currentUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, refetch: loadSession }),
    [status, user, login, logout, loadSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
