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
import { canAccessRoute } from "./route-access";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "inactive";

export type AuthContextValue = {
  status: AuthStatus;
  user: CurrentUser | null;
  login: (input: LoginInput) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  /** Re-checks the current session against the API (e.g. after a 401 elsewhere in the app). */
  refetch: () => Promise<void>;
  sessionExpiredNotice: boolean;
  clearSessionExpiredNotice: () => void;
  /** True when the verified user may open the current path */
  canOpenPath: (pathname: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

import { clearOfflineQueueOnLogout } from "@/lib/offline/queue-store";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const currentUser = await fetchCurrentUser();
      if (currentUser.status !== "ACTIVE") {
        setUser(currentUser);
        setStatus("inactive");
        return;
      }
      setUser(currentUser);
      setStatus("authenticated");
      return;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "UNKNOWN";
      if (isSessionExpiredCode(code)) {
        try {
          const refreshedUser = await refreshSession();
          if (refreshedUser.status !== "ACTIVE") {
            setUser(refreshedUser);
            setStatus("inactive");
            return;
          }
          setUser(refreshedUser);
          setStatus("authenticated");
          return;
        } catch {
          setSessionExpiredNotice(true);
        }
      }
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    function onSessionExpired() {
      setSessionExpiredNotice(true);
      setUser(null);
      setStatus("unauthenticated");
    }
    window.addEventListener("nelna:session-expired", onSessionExpired);
    return () => window.removeEventListener("nelna:session-expired", onSessionExpired);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const currentUser = await apiLogin(input);
    setSessionExpiredNotice(false);
    if (currentUser.status !== "ACTIVE") {
      setUser(currentUser);
      setStatus("inactive");
      return currentUser;
    }
    setUser(currentUser);
    setStatus("authenticated");
    return currentUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      try {
        await clearOfflineQueueOnLogout();
      } catch {
        // Ignore storage cleanup failures on logout.
      }
      setUser(null);
      setStatus("unauthenticated");
      setSessionExpiredNotice(false);
    }
  }, []);

  const clearSessionExpiredNotice = useCallback(() => setSessionExpiredNotice(false), []);

  const canOpenPath = useCallback(
    (pathname: string) => {
      if (!user) return false;
      return canAccessRoute(pathname, user.roles, user.permissions);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      logout,
      refetch: loadSession,
      sessionExpiredNotice,
      clearSessionExpiredNotice,
      canOpenPath,
    }),
    [status, user, login, logout, loadSession, sessionExpiredNotice, clearSessionExpiredNotice, canOpenPath],
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
