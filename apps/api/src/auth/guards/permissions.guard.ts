import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { PermissionKey } from "@nelna/shared";
import { AuthForbiddenException, NotAuthenticatedException } from "../auth.errors";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

/** Runs after JwtAuthGuard. Allows the request through when no `@RequirePermissions()` are declared. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionKey[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) {
      throw new NotAuthenticatedException();
    }

    const hasPermission = requiredPermissions.some((permission) =>
      user.permissions.includes(permission),
    );
    if (!hasPermission) {
      throw new AuthForbiddenException();
    }

    return true;
  }
}
