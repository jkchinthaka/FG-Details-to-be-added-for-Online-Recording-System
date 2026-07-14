"use client";

import { useEffect, useState } from "react";
import { Button } from "@nelna/ui";

/** Registers the service worker and prompts when a new version is waiting. */
export function ServiceWorkerRegistrar() {
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (cancelled) return;
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(registration);
            }
          });
        });
      })
      .catch(() => {
        // Installability remains via manifest even if SW registration fails in some browsers.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-[70] flex justify-center px-4 md:bottom-6">
      <div className="flex items-center gap-3 rounded-[var(--nelna-radius)] border border-[var(--nelna-border)] bg-white px-4 py-3 shadow-md">
        <p className="text-sm text-nelna-primary-dark">A new app version is ready.</p>
        <Button
          type="button"
          onClick={() => {
            updateReady.waiting?.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }}
        >
          Update
        </Button>
      </div>
    </div>
  );
}
