import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@nelna/ui", "@nelna/shared"],
  reactStrictMode: true,
};

export default nextConfig;
