import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import type { RequestUser } from "../auth.types";

/** Injects the authenticated user (as attached by JwtAuthGuard) into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
