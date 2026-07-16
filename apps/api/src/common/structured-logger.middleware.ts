import type { NextFunction, Request, Response } from "express";
import { redactForLog } from "@nelna/shared";
import { resolveCommitShaFromEnv } from "@nelna/shared";
import { getRequestId } from "./request-id.middleware";
import { metricsServiceSingleton } from "../metrics/metrics.module";

/**
 * Structured JSON access log with redaction (FG-SEC-001 / FG-MON-001).
 */
export function structuredRequestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const started = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - started;
    const route = String(req.route?.path ?? req.path);
    metricsServiceSingleton.increment("http_requests_total");
    metricsServiceSingleton.increment(`http_status_${Math.floor(res.statusCode / 100)}xx`);
    if (res.statusCode >= 500) metricsServiceSingleton.increment("http_errors_5xx");
    if (res.statusCode === 409) metricsServiceSingleton.increment("stale_state_conflicts");
    if (res.statusCode === 429) metricsServiceSingleton.increment("rate_limited");
    metricsServiceSingleton.observeDuration("http_request", durationMs);
    metricsServiceSingleton.observeDuration(`http_route:${route}`, durationMs);
    if (durationMs >= 2_000) metricsServiceSingleton.increment("slow_requests_ge_2s");

    const payload = redactForLog({
      event: "http_request",
      requestId: getRequestId(req),
      method: req.method,
      route,
      path: req.path,
      status: res.statusCode,
      durationMs,
      userId: req.nelnaUserId ?? null,
      buildId: resolveCommitShaFromEnv(process.env)?.slice(0, 12) ?? null,
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  });
  next();
}
