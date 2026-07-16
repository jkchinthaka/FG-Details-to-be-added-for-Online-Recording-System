import { describe, expect, it } from "vitest";
import {
  PRODUCTION_RENDER_API_ORIGIN,
  ApiInternalUrlError,
  assertProductionApiInternalUrl,
  assertProductionWranglerProxyVars,
  assertUatApiInternalUrl,
  isPrivateOrLocalHostname,
  normalizeApiInternalUrl,
} from "./api-internal-url";

describe("api-internal-url", () => {
  it("accepts a valid Render HTTPS URL", () => {
    expect(assertProductionApiInternalUrl(PRODUCTION_RENDER_API_ORIGIN)).toBe(
      PRODUCTION_RENDER_API_ORIGIN,
    );
    expect(
      assertProductionWranglerProxyVars({
        NEXT_PUBLIC_API_URL: "/api",
        API_INTERNAL_URL: PRODUCTION_RENDER_API_ORIGIN,
      }),
    ).toBe(PRODUCTION_RENDER_API_ORIGIN);
  });

  it("rejects missing API_INTERNAL_URL in production", () => {
    expect(() => assertProductionApiInternalUrl(undefined)).toThrow(ApiInternalUrlError);
    expect(() => assertProductionApiInternalUrl("")).toThrow(/required/i);
    expect(() => assertProductionWranglerProxyVars({ NEXT_PUBLIC_API_URL: "/api" })).toThrow(
      /required/i,
    );
  });

  it("rejects localhost in production", () => {
    expect(() => assertProductionApiInternalUrl("http://localhost:3001")).toThrow(
      /localhost|https/i,
    );
    expect(() => assertProductionApiInternalUrl("https://localhost:3001")).toThrow(
      /localhost/i,
    );
    expect(() => assertProductionApiInternalUrl("https://127.0.0.1:3001")).toThrow(
      /localhost|private/i,
    );
  });

  it("rejects private IP hosts in production", () => {
    expect(() => assertProductionApiInternalUrl("https://10.0.0.5")).toThrow(/private/i);
    expect(() => assertProductionApiInternalUrl("https://192.168.1.10")).toThrow(/private/i);
    expect(() => assertProductionApiInternalUrl("https://172.16.0.2")).toThrow(/private/i);
    expect(isPrivateOrLocalHostname("10.1.2.3")).toBe(true);
    expect(isPrivateOrLocalHostname("fg-details-to-be-added-for-online.onrender.com")).toBe(
      false,
    );
  });

  it("rejects duplicated /api path on API_INTERNAL_URL", () => {
    expect(() =>
      normalizeApiInternalUrl("https://fg-details-to-be-added-for-online.onrender.com/api"),
    ).toThrow(/must not include \/api/);
    expect(() =>
      assertProductionApiInternalUrl(
        "https://fg-details-to-be-added-for-online.onrender.com/api/",
      ),
    ).toThrow(ApiInternalUrlError);
    expect(
      normalizeApiInternalUrl("https://fg-details-to-be-added-for-online.onrender.com/"),
    ).toBe(PRODUCTION_RENDER_API_ORIGIN);
  });

  it("refuses UAT silently pointing at production", () => {
    expect(assertUatApiInternalUrl(undefined)).toBeNull();
    expect(() => assertUatApiInternalUrl(PRODUCTION_RENDER_API_ORIGIN)).toThrow(
      /must not point at the production/i,
    );
  });
});
