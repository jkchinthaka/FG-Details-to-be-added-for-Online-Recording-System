import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { PermissionKey, UserRole } from "@nelna/shared";
import { AUTH_COOKIE_NAMES } from "@nelna/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { getAuthConfig } from "../auth.config";
import {
  AccountInactiveException,
  NotAuthenticatedException,
  SessionExpiredException,
} from "../auth.errors";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AccessTokenPayload, RequestUser } from "../auth.types";

/**
 * Global guard: valid access token cookie unless `@Public()`.
 * After JWT verify, reloads the user from MongoDB so status, authVersion,
 * roles and permissions are current (not stale token claims alone).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
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

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: accessTokenSecret,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TokenExpiredError") {
        throw new SessionExpiredException();
      }
      throw new NotAuthenticatedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotAuthenticatedException();
    }
    if (user.status !== "ACTIVE") {
      throw new AccountInactiveException();
    }

    const dbAuthVersion = user.authVersion ?? 0;
    const tokenAuthVersion = payload.authVersion ?? 0;
    if (tokenAuthVersion !== dbAuthVersion) {
      throw new SessionExpiredException();
    }

    const roles = user.userRoles.map((ur) => ur.role.name as UserRole);
    const permissions = new Set<PermissionKey>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissions.add(rp.permission.key as PermissionKey);
      }
    }

    request.user = {
      id: user.id,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      roles,
      permissions: Array.from(permissions),
      mustChangePassword: user.mustChangePassword,
      authVersion: dbAuthVersion,
    } satisfies RequestUser;
    return true;
  }
}
