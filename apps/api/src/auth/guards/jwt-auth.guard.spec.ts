import { ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { NotAuthenticatedException, SessionExpiredException } from "../auth.errors";
import { AUTH_COOKIE_NAMES } from "@nelna/shared";

function buildContext(cookies: Record<string, string>): {
  context: ExecutionContext;
  request: { cookies: Record<string, string>; user?: unknown };
} {
  const request: { cookies: Record<string, string>; user?: unknown } = { cookies };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe("JwtAuthGuard", () => {
  const previousSecret = process.env.JWT_ACCESS_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    process.env.JWT_ACCESS_SECRET = previousSecret;
    process.env.NODE_ENV = previousNodeEnv;
  });

  function buildGuard(reflectorReturn: boolean | undefined = undefined) {
    const jwtService = new JwtService({ secret: "test-access-secret" });
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(reflectorReturn),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(jwtService, reflector);
    return { guard, jwtService };
  }

  it("allows public routes through without a token", async () => {
    const { guard } = buildGuard(true);
    const { context } = buildContext({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects requests with no access token cookie", async () => {
    const { guard } = buildGuard(false);
    const { context } = buildContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      NotAuthenticatedException,
    );
  });

  it("rejects an invalid/tampered token", async () => {
    const { guard } = buildGuard(false);
    const { context } = buildContext({
      [AUTH_COOKIE_NAMES.accessToken]: "not-a-real-token",
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      NotAuthenticatedException,
    );
  });

  it("rejects an expired token with SessionExpiredException", async () => {
    const { guard, jwtService } = buildGuard(false);
    const token = await jwtService.signAsync(
      {
        sub: "user-1",
        employeeCode: "EMP-1",
        fullName: "Test User",
        roles: [],
        permissions: [],
      },
      { secret: "test-access-secret", expiresIn: "0s" },
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const { context } = buildContext({ [AUTH_COOKIE_NAMES.accessToken]: token });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SessionExpiredException,
    );
  });

  it("attaches the decoded user to the request on a valid token", async () => {
    const { guard, jwtService } = buildGuard(false);
    const token = await jwtService.signAsync(
      {
        sub: "user-1",
        employeeCode: "EMP-1",
        fullName: "Test User",
        roles: ["FG_OPERATOR"],
        permissions: ["records:create"],
      },
      { secret: "test-access-secret", expiresIn: "15m" },
    );
    const { context, request } = buildContext({ [AUTH_COOKIE_NAMES.accessToken]: token });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      id: "user-1",
      employeeCode: "EMP-1",
      roles: ["FG_OPERATOR"],
      permissions: ["records:create"],
    });
  });
});
