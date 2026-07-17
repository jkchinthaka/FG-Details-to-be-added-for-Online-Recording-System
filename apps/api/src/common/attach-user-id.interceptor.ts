import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import type { Request } from "express";

/** Copies authenticated user id onto the request for structured logs. */
@Injectable()
export class AttachUserIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    if (req.user?.id) {
      req.nelnaUserId = req.user.id;
    }
    return next.handle();
  }
}
