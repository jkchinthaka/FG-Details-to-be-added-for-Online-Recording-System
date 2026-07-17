import { describe, expect, it } from "vitest";
import {
  buildApiErrorEnvelope,
  isValidRequestId,
  REQUEST_ID_HEADER,
} from "./api-error";
import { redactForLog, redactAuditDiff } from "./log-redaction";

describe("FG-ERR-001 api error envelope", () => {
  it("builds a stable envelope with requestId", () => {
    const envelope = buildApiErrorEnvelope({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Validation failed.",
      requestId: "req-12345678",
      fieldErrors: [{ field: "username", message: "Required" }],
      retryable: false,
    });
    expect(envelope).toEqual({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Validation failed.",
      fieldErrors: [{ field: "username", message: "Required" }],
      requestId: "req-12345678",
      retryable: false,
    });
  });

  it("validates request ids", () => {
    expect(isValidRequestId("abcd-efgh-ijkl")).toBe(true);
    expect(isValidRequestId("short")).toBe(false);
    expect(isValidRequestId("has spaces oh no")).toBe(false);
    expect(REQUEST_ID_HEADER).toBe("x-request-id");
  });
});

describe("FG-SEC-001 / FG-AUD-001 log redaction", () => {
  it("redacts secrets from structured logs", () => {
    const redacted = redactForLog({
      password: "secret",
      authorization: "Bearer abc.def",
      DATABASE_URL: "mongodb+srv://user:pass@cluster/fg_online",
      nested: { refreshToken: "tok", ok: true },
      note: "cookie nelna_access_token=abc123; path=/",
    }) as Record<string, unknown>;

    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted.DATABASE_URL).toBe("[REDACTED]");
    expect((redacted.nested as Record<string, unknown>).refreshToken).toBe("[REDACTED]");
    expect(String(redacted.note)).not.toContain("abc123");
  });

  it("excludes secrets from audit diffs", () => {
    const diff = redactAuditDiff({
      fullName: "Operator",
      passwordHash: "$2b$12$abc",
      password: "plain",
    });
    expect(diff?.fullName).toBe("Operator");
    expect(diff?.passwordHash).toBe("[REDACTED]");
    expect(diff?.password).toBe("[REDACTED]");
  });
});
