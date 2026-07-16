import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { validateCloudflareProxyConfigForProductionBuild } from "./src/lib/proxy/validate-wrangler-proxy-config";

// Enables Cloudflare bindings during `next dev` when Wrangler is available.
initOpenNextCloudflareForDev();

if (process.env.NODE_ENV === "production") {
  validateCloudflareProxyConfigForProductionBuild();
  process.env.NEXT_PUBLIC_API_URL ??= "/api";
}

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const connectSrc =
  apiOrigin.startsWith("http://") || apiOrigin.startsWith("https://")
    ? `'self' ${apiOrigin}`
    : "'self'";

const nextConfig: NextConfig = {
  transpilePackages: ["@nelna/ui", "@nelna/shared"],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              `connect-src ${connectSrc}`,
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
