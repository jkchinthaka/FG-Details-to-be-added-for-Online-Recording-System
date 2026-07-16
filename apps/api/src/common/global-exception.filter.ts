import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  buildApiErrorEnvelope,
  type ApiFieldError,
  redactForLog,
} from "@nelna/shared";
import { getRequestId } from "./request-id.middleware";

type ExceptionBody = {
  code?: string;
  message?: string | string[];
  retryable?: boolean;
  fieldErrors?: ApiFieldError[];
  errors?: unknown;
  statusCode?: number;
  error?: string;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function mapCode(status: number, body: ExceptionBody): string {
  if (typeof body.code === "string" && body.code.trim()) return body.code.trim();
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 415) return "UNSUPPORTED_MEDIA_TYPE";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502) return "BAD_GATEWAY";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status === 504) return "GATEWAY_TIMEOUT";
  if (status >= 500) return "INTERNAL_ERROR";
  return "HTTP_ERROR";
}

function safeMessage(status: number, body: ExceptionBody): string {
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }
  if (Array.isArray(body.message) && body.message.length > 0) {
    return "Validation failed.";
  }
  if (status === 429) return "Too many requests. Please try again later.";
  if (status === 401) return "Sign in to continue.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "Resource not found.";
  if (status === 409) return "Conflict with the current state.";
  if (status >= 500) return "An unexpected error occurred.";
  return "Request failed.";
}

function fieldErrorsFromBody(body: ExceptionBody): ApiFieldError[] {
  if (Array.isArray(body.fieldErrors)) return body.fieldErrors;
  if (Array.isArray(body.message)) {
    return body.message.map((message) => ({
      field: "body",
      message: String(message),
    }));
  }
  if (Array.isArray(body.errors)) {
    return body.errors.map((err) => {
      if (err && typeof err === "object") {
        const row = err as Record<string, unknown>;
        return {
          field: String(row.field ?? row.path ?? "body"),
          code: typeof row.code === "string" ? row.code : undefined,
          message: String(row.message ?? row),
        };
      }
      return { field: "body", message: String(err) };
    });
  }
  return [];
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("GlobalExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = getRequestId(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ExceptionBody = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();
      if (typeof raw === "string") {
        body = { message: raw };
      } else if (raw && typeof raw === "object") {
        body = raw as ExceptionBody;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        JSON.stringify(
          redactForLog({
            event: "unhandled_exception",
            requestId,
            name: exception.name,
            ...(isProduction()
              ? { message: "internal_error" }
              : {
                  message: exception.message,
                  stack: exception.stack,
                }),
          }),
        ),
      );
    }

    const code = mapCode(status, body);
    const retryable =
      typeof body.retryable === "boolean"
        ? body.retryable
        : status === 429 || status === 503 || status === 504;

    const envelope = buildApiErrorEnvelope({
      statusCode: status,
      code,
      message: safeMessage(status, body),
      requestId,
      fieldErrors: fieldErrorsFromBody(body),
      retryable,
    });

    // Never leak DB internals / stacks in production responses.
    response.status(status).json(envelope);
  }
}
