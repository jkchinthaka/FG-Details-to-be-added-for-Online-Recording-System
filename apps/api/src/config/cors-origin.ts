import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

const PRODUCTION_FRONTEND_ORIGIN = "https://fg.nelna.lk";
const LOCAL_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;

/**
 * Exact-origin CORS for Nest. Production: only the configured frontend
 * (defaults to https://fg.nelna.lk). Non-production: localhost allowed
 * plus optional API_CORS_ORIGIN. Always credentials: true.
 */
export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const isProduction = env.NODE_ENV === "production";
  const configured = (env.API_CORS_ORIGIN ?? "").trim();

  if (isProduction) {
    const origin = configured || PRODUCTION_FRONTEND_ORIGIN;
    return {
      origin,
      credentials: true,
    };
  }

  const allow = new Set<string>([...LOCAL_DEV_ORIGINS]);
  if (configured) {
    allow.add(configured);
  }

  return {
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allow.has(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  };
}

export function isCorsOriginAllowed(
  requestOrigin: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const isProduction = env.NODE_ENV === "production";
  const configured = (env.API_CORS_ORIGIN ?? "").trim();

  if (isProduction) {
    const origin = configured || PRODUCTION_FRONTEND_ORIGIN;
    return Boolean(requestOrigin) && requestOrigin === origin;
  }

  if (!requestOrigin) return true;
  if (LOCAL_DEV_ORIGINS.includes(requestOrigin as (typeof LOCAL_DEV_ORIGINS)[number])) {
    return true;
  }
  return Boolean(configured) && requestOrigin === configured;
}

export { PRODUCTION_FRONTEND_ORIGIN, LOCAL_DEV_ORIGINS };

/** Primary configured browser origin for CSRF / mutation checks. */
export function resolveCorsOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.API_CORS_ORIGIN ?? "").trim();
  if (env.NODE_ENV === "production") {
    return configured || PRODUCTION_FRONTEND_ORIGIN;
  }
  return configured || LOCAL_DEV_ORIGINS[0];
}
