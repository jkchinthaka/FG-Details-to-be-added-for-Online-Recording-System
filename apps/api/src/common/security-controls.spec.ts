import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MutationProtectionGuard } from "./mutation-protection.guard";
import { GlobalExceptionFilter } from "./global-exception.filter";
import { StaleStateException } from "./stale-state.exception";
import { requestIdMiddleware } from "./request-id.middleware";
import {
  isDevUiSurfaceEnabled,
  isPublicApiDocsEnabled,
} from "./production-surfaces";
import type { Request, Response } from "express";

function mockHttpContext(req: Partial<Request>, res: Partial<Response> = {}) {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const response = { status, json, ...res } as unknown as Response;
  const request = { nelnaRequestId: "req-test-001", ...req } as unknown as Request;
  return {
    request,
    response,
    status,
    json,
    host: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    },
  };
}

describe("FG-ERR-001 GlobalExceptionFilter", () => {
  const filter = new GlobalExceptionFilter();

  it("maps stale-state conflicts to stable envelope", () => {
    const ctx = mockHttpContext({});
    filter.catch(new StaleStateException(), ctx.host as never);
    expect(ctx.status).toHaveBeenCalledWith(409);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: "STALE_STATE",
        requestId: "req-test-001",
        retryable: false,
        fieldErrors: [],
      }),
    );
  });

  it("maps validation-style BadRequest arrays", () => {
    const { BadRequestException } = require("@nestjs/common");
    const ctx = mockHttpContext({});
    filter.catch(
      new BadRequestException({
        message: ["username must be longer", "password required"],
        error: "Bad Request",
        statusCode: 400,
      }),
      ctx.host as never,
    );
    const body = ctx.json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.fieldErrors.length).toBeGreaterThan(0);
    expect(body.requestId).toBe("req-test-001");
    expect(JSON.stringify(body)).not.toMatch(/stack|prisma|mongodb\+srv/i);
  });

  it("hides internal details for unknown errors", () => {
    const ctx = mockHttpContext({});
    filter.catch(new Error("ECONNREFUSED 127.0.0.1:27017 secret"), ctx.host as never);
    const body = ctx.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.message).toBe("An unexpected error occurred.");
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|27017|secret|stack/i);
  });

  it("maps service unavailable as retryable", () => {
    const ctx = mockHttpContext({});
    filter.catch(
      new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Upstream unavailable",
      }),
      ctx.host as never,
    );
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: "SERVICE_UNAVAILABLE",
        retryable: true,
        requestId: "req-test-001",
      }),
    );
  });

  it("maps gateway timeout as retryable", () => {
    const ctx = mockHttpContext({});
    filter.catch(
      new HttpException(
        { code: "UPSTREAM_TIMEOUT", message: "Upstream timeout" },
        HttpStatus.GATEWAY_TIMEOUT,
      ),
      ctx.host as never,
    );
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 504,
        code: "UPSTREAM_TIMEOUT",
        retryable: true,
      }),
    );
  });

  it("maps rate limit to safe 429 envelope", () => {
    const ctx = mockHttpContext({});
    filter.catch(
      new HttpException(
        { message: "ThrottlerException: Too Many Requests" },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
      ctx.host as never,
    );
    const body = ctx.json.mock.calls[0][0];
    expect(body.statusCode).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.retryable).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/stack|ThrottlerException/i);
  });
});

describe("FG-SEC-002 production surfaces", () => {
  it("blocks public Swagger in production", () => {
    expect(isPublicApiDocsEnabled("production")).toBe(false);
    expect(isPublicApiDocsEnabled("development")).toBe(true);
  });

  it("blocks developer UI surfaces in production", () => {
    expect(isDevUiSurfaceEnabled("production")).toBe(false);
    expect(isDevUiSurfaceEnabled("test")).toBe(true);
  });
});

describe("FG-ERR-001 requestId middleware", () => {
  it("accepts a valid inbound id", () => {
    const req = {
      header: (name: string) =>
        name.toLowerCase() === "x-request-id" ? "inbound-request-id-01" : undefined,
    } as unknown as Request;
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
    } as unknown as Response;
    const next = jest.fn();
    requestIdMiddleware(req, res, next);
    expect(req.nelnaRequestId).toBe("inbound-request-id-01");
    expect(headers["x-request-id"]).toBe("inbound-request-id-01");
    expect(next).toHaveBeenCalled();
  });

  it("generates when inbound id is invalid", () => {
    const req = {
      header: () => "bad",
    } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    requestIdMiddleware(req, res, jest.fn());
    expect(req.nelnaRequestId && req.nelnaRequestId.length >= 8).toBe(true);
  });
});

describe("FG-SEC-001 MutationProtectionGuard", () => {
  const guard = new MutationProtectionGuard();
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  function context(req: Record<string, unknown>) {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    };
  }

  it("allows GET", () => {
    process.env.NODE_ENV = "production";
    process.env.API_CORS_ORIGIN = "https://fg.nelna.lk";
    expect(
      guard.canActivate(
        context({
          method: "GET",
          header: () => undefined,
          headers: {},
        }) as never,
      ),
    ).toBe(true);
  });

  it("blocks cross-site mutations", () => {
    process.env.NODE_ENV = "production";
    process.env.API_CORS_ORIGIN = "https://fg.nelna.lk";
    expect(() =>
      guard.canActivate(
        context({
          method: "POST",
          header: (name: string) =>
            name.toLowerCase() === "sec-fetch-site" ? "cross-site" : undefined,
          headers: { cookie: "nelna_access_token=x" },
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows trusted same-origin Origin", () => {
    process.env.NODE_ENV = "production";
    process.env.API_CORS_ORIGIN = "https://fg.nelna.lk";
    expect(
      guard.canActivate(
        context({
          method: "POST",
          header: (name: string) =>
            name.toLowerCase() === "origin" ? "https://fg.nelna.lk" : undefined,
          headers: { cookie: "nelna_access_token=x" },
        }) as never,
      ),
    ).toBe(true);
  });

  it("rejects invalid origin for cookie mutations in production", () => {
    process.env.NODE_ENV = "production";
    process.env.API_CORS_ORIGIN = "https://fg.nelna.lk";
    expect(() =>
      guard.canActivate(
        context({
          method: "POST",
          header: () => undefined,
          headers: { cookie: "nelna_access_token=x" },
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });
});
