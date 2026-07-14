import type { VehicleSearchResponse } from "@nelna/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

/**
 * Searches vehicles for the freezer truck inspection's vehicle selector
 * (`GET /vehicles?q=`). Omitting `query` returns the "recent vehicles"
 * fallback list instead of a text-match search — see
 * `VehicleSearchResponse.isRecent`.
 */
export async function searchVehicles(
  query?: string,
  limit?: number,
): Promise<VehicleSearchResponse> {
  const params = new URLSearchParams();
  if (query && query.trim()) params.set("q", query.trim());
  if (limit) params.set("limit", String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/vehicles${suffix}`, {
      credentials: "include",
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Non-JSON error body — fall back to the generic message above.
    }
    throw new Error(message);
  }

  return (await response.json()) as VehicleSearchResponse;
}
