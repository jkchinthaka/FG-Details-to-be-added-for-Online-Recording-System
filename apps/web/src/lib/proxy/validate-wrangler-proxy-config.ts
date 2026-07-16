/**
 * Fail Cloudflare/OpenNext production builds when wrangler production proxy
 * vars are missing or unsafe (localhost / private / duplicated /api).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertProductionWranglerProxyVars,
  assertUatApiInternalUrl,
  type WranglerProxyVars,
} from "./api-internal-url";

function stripJsonc(source: string): string {
  // Remove block comments, line comments, then trailing commas (Prettier JSONC).
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/,\s*([\]}])/g, "$1");
}

export function validateCloudflareProxyConfigForProductionBuild(
  wranglerPath: string = path.join(process.cwd(), "wrangler.jsonc"),
): string {
  const raw = readFileSync(wranglerPath, "utf8");
  const config = JSON.parse(stripJsonc(raw)) as {
    vars?: WranglerProxyVars;
    env?: { uat?: { vars?: WranglerProxyVars } };
  };

  const origin = assertProductionWranglerProxyVars(config.vars ?? {});
  assertUatApiInternalUrl(config.env?.uat?.vars?.API_INTERNAL_URL);
  return origin;
}
