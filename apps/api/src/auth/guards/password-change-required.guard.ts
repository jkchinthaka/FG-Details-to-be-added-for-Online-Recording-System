import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

const ALLOWED_WHEN_MUST_CHANGE = new Set([
  "POST /auth/change-password",
  "GET /auth/me",
  "POST /auth/logout",
  "POST /auth/refresh",
]);

/**
 * When mustChangePassword=true, block all authenticated business APIs except
 * password change, me, logout (and public routes which skip this guard path).
 */
@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user?.mustChangePassword) {
      return true;
    }

    const method = (request.method || "GET").toUpperCase();
    const path = (request.path || request.url || "").split("?")[0] ?? "";
    const normalized = path.replace(/\/+$/, "") || "/";
    const key = `${method} ${normalized}`;

    if (ALLOWED_WHEN_MUST_CHANGE.has(key)) {
      return true;
    }

    throw new ForbiddenException({
      statusCode: 403,
      code: "PASSWORD_CHANGE_REQUIRED",
      message: "Change your temporary password to continue.",
    });
  }
}
