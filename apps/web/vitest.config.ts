import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // The app's tsconfig sets jsx: "preserve" (Next.js/SWC handles the actual
  // transform at build time) — Vitest has no such downstream step, so it
  // needs esbuild to compile JSX itself via the automatic runtime here.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
