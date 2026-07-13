"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncResourceState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export type AsyncResource<T> = AsyncResourceState<T> & {
  /** Re-runs the fetcher, e.g. from a per-widget "Retry" button. */
  retry: () => void;
};

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Small, dependency-free async-fetch hook shared by every dashboard widget.
 * Each widget gets its own loading/error/retry state so one failing endpoint
 * never blocks the rest of the "Today's Tasks" page (see docs/records.md).
 */
export function useAsyncResource<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncResource<T> {
  const [state, setState] = useState<AsyncResourceState<T>>({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });

    fetcherRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
        setState({ status: "error", data: null, error: message });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, ...deps]);

  return { ...state, retry } as AsyncResource<T>;
}
