import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { resolveCorsOrigin } from "../config/cors-origin";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF / cross-site mutation protection (FG-SEC-001).
 * Cookie-authenticated browsers must present a trusted Origin or
 * Fetch-Metadata same-origin/same-site. Trusted Worker proxy forwards Origin.
 */
@Injectable()
export class MutationProtectionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const method = (req.method || "GET").toUpperCase();
    if (SAFE_METHODS.has(method)) return true;

    const origin = req.header("origin")?.trim() || "";
    const fetchSite = (req.header("sec-fetch-site") || "").toLowerCase();
    const allowedOrigin = resolveCorsOrigin();
    const edgeProxy = req.header("x-nelna-edge-proxy") === "1";

    if (fetchSite === "cross-site") {
      throw new ForbiddenException({
        code: "CROSS_SITE_MUTATION_BLOCKED",
        message: "Cross-site mutations are not allowed.",
      });
    }

    if (origin && allowedOrigin && originsMatch(origin, allowedOrigin)) {
      return true;
    }

    if (fetchSite === "same-origin" || fetchSite === "same-site") {
      return true;
    }

    // Trusted same-origin Worker proxy with matching Origin.
    if (edgeProxy && origin && allowedOrigin && originsMatch(origin, allowedOrigin)) {
      return true;
    }

    // Local/dev tooling without browser Fetch-Metadata (no Origin).
    if (process.env.NODE_ENV !== "production" && !origin && !fetchSite) {
      return true;
    }

    // Server-to-server health/ops without cookies is still gated by JWT elsewhere;
    // reject cookie-bearing mutations without Origin in production.
    const hasCookie = Boolean(req.headers.cookie);
    if (process.env.NODE_ENV === "production" && hasCookie) {
      throw new ForbiddenException({
        code: "INVALID_ORIGIN",
        message: "Mutation rejected: missing or invalid Origin.",
      });
    }

    if (process.env.NODE_ENV === "production" && origin && allowedOrigin) {
      if (!originsMatch(origin, allowedOrigin)) {
        throw new ForbiddenException({
          code: "INVALID_ORIGIN",
          message: "Mutation rejected: Origin is not trusted.",
        });
      }
    }

    return true;
  }
}

function originsMatch(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.origin === right.origin;
  } catch {
    return a === b;
  }
}
