import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { REQUEST_ID_HEADER, isValidRequestId } from "@nelna/shared";

export const REQUEST_ID_PROP = "nelnaRequestId";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      nelnaRequestId?: string;
      nelnaUserId?: string;
    }
  }
}

/**
 * Accept a valid trusted inbound request ID or generate one.
 * Always echoes `x-request-id` on the response.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER)?.trim();
  const id = isValidRequestId(incoming) ? incoming!.trim() : randomUUID();
  req.nelnaRequestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

export function getRequestId(req: { nelnaRequestId?: string } | undefined): string {
  return req?.nelnaRequestId ?? "unknown";
}
