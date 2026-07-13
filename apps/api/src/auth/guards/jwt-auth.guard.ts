import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AUTH_COOKIE_NAMES } from "@nelna/shared";
import { getAuthConfig } from "../auth.config";
import { NotAuthenticatedException, SessionExpiredException } from "../auth.errors";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AccessTokenPayload, RequestUser } from "../auth.types";

/**
 * Global guard: every route requires a valid access token cookie unless
 * annotated with `@Public()`. Verification is purely cryptographic/stateless
 * (no DB lookup) — see auth.types.ts for the trade-off this implies.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[AUTH_COOKIE_NAMES.accessToken] as string | undefined;

    if (!token) {
      throw new NotAuthenticatedException();
    }

    const { accessTokenSecret } = getAuthConfig();

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: accessTokenSecret,
      });
      request.user = {
        id: payload.sub,
        employeeCode: payload.employeeCode,
        fullName: payload.fullName,
        roles: payload.roles,
        permissions: payload.permissions,
      } satisfies RequestUser;
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "TokenExpiredError") {
        throw new SessionExpiredException();
      }
      throw new NotAuthenticatedException();
    }
  }
}
