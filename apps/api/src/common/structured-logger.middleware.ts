import type { NextFunction, Request, Response } from "express";
import { redactForLog } from "@nelna/shared";
import { resolveCommitShaFromEnv } from "@nelna/shared";
import { getRequestId } from "./request-id.middleware";

/**
 * Structured JSON access log with redaction (FG-SEC-001).
 */
export function structuredRequestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const started = Date.now();
  res.on("finish", () => {
    const payload = redactForLog({
      event: "http_request",
      requestId: getRequestId(req),
      method: req.method,
      route: req.route?.path ?? req.path,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - started,
      userId: req.nelnaUserId ?? null,
      buildId: resolveCommitShaFromEnv(process.env)?.slice(0, 12) ?? null,
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  });
  next();
}
