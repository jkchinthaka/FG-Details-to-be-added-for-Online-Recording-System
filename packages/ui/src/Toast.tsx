"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "warning" | "danger" | "information";

export type ToastOptions = {
  title?: string;
  description: string;
  tone?: ToastTone;
  /** Set to 0 to require manual dismissal. Defaults to 4000ms. */
  durationMs?: number;
};

type ToastItem = ToastOptions & { id: number };

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Provides an imperative toast API via `useToast()` and renders the fixed viewport. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      const toast: ToastItem = { tone: "information", durationMs: 4000, ...options, id };
      setToasts((prev) => [...prev, toast]);
      if (toast.durationMs && toast.durationMs > 0) {
        setTimeout(() => dismissToast(id), toast.durationMs);
      }
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="nelna-toast-viewport" aria-live="polite" role="status">
        {toasts.map((toast) => (
          <div key={toast.id} className={`nelna-toast nelna-toast-${toast.tone ?? "information"}`}>
            <div style={{ flex: 1 }}>
              {toast.title ? <p style={{ margin: 0, fontWeight: 700 }}>{toast.title}</p> : null}
              <p style={{ margin: toast.title ? "0.15rem 0 0" : 0 }}>{toast.description}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              className="nelna-focusable"
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                fontSize: "1.1rem",
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
