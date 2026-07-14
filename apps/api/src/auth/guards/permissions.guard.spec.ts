import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
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

function buildGuard(requiredPermissions: string[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions),
  } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

const qa: RequestUser = {
  id: "u1",
  employeeCode: "EMP-QA",
  fullName: "QA",
  roles: ["QA_EXECUTIVE"],
  permissions: ["records:read", "records:verify"],
};

describe("PermissionsGuard", () => {
  it("allows requests through when no permissions are required", () => {
    const guard = buildGuard(undefined);
    expect(guard.canActivate(buildContext(qa))).toBe(true);
  });

  it("throws NotAuthenticatedException when no user is attached", () => {
    const guard = buildGuard(["records:verify"]);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      NotAuthenticatedException,
    );
  });

  it("allows a user holding one of the required permissions", () => {
    const guard = buildGuard(["records:verify", "templates:publish"]);
    expect(guard.canActivate(buildContext(qa))).toBe(true);
  });

  it("forbids a user missing all required permissions", () => {
    const guard = buildGuard(["users:manage"]);
    expect(() => guard.canActivate(buildContext(qa))).toThrow(AuthForbiddenException);
  });
});
