/**
 * FG-SEC-002 — gates for production diagnostic / developer surfaces.
 * Keep these pure so unit tests can assert the policy without bootstrapping Nest.
 */

export function isPublicApiDocsEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== "production";
}

export function isDevUiSurfaceEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== "production";
}
