import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsyncResource } from "./useAsyncResource";

describe("useAsyncResource", () => {
  it("starts loading, then resolves to success with the fetched data", async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 42 });
    const { result } = renderHook(() => useAsyncResource(fetcher));

    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual({ value: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("surfaces a rejected fetch as an error state with the error's message", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("Network down"));
    const { result } = renderHook(() => useAsyncResource(fetcher));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Network down");
    expect(result.current.data).toBeNull();
  });

  it("falls back to a generic message when the rejection isn't an Error", async () => {
    const fetcher = vi.fn().mockRejectedValue("boom");
    const { result } = renderHook(() => useAsyncResource(fetcher));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Something went wrong. Please try again.");
  });

  it("re-runs the fetcher and returns to loading when retry() is called", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce({ value: 1 });
    const { result } = renderHook(() => useAsyncResource(fetcher));

    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual({ value: 1 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
