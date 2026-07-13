import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { AuthForbiddenException, NotAuthenticatedException } from "../auth.errors";
import type { RequestUser } from "../auth.types";

function buildContext(user: RequestUser | undefined): ExecutionContext {
  const request = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function buildGuard(requiredRoles: string[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

const operator: RequestUser = {
  id: "u1",
  employeeCode: "EMP-1",
  fullName: "Op",
  roles: ["FG_OPERATOR"],
  permissions: ["records:create"],
};

describe("RolesGuard", () => {
  it("allows requests through when no roles are required", () => {
    const guard = buildGuard(undefined);
    expect(guard.canActivate(buildContext(operator))).toBe(true);
  });

  it("throws NotAuthenticatedException when no user is attached", () => {
    const guard = buildGuard(["FG_OPERATOR"]);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(NotAuthenticatedException);
  });

  it("allows a user holding one of the required roles", () => {
    const guard = buildGuard(["FG_OPERATOR", "FG_SUPERVISOR"]);
    expect(guard.canActivate(buildContext(operator))).toBe(true);
  });

  it("forbids a user missing all required roles", () => {
    const guard = buildGuard(["SYSTEM_ADMINISTRATOR"]);
    expect(() => guard.canActivate(buildContext(operator))).toThrow(AuthForbiddenException);
  });
});
