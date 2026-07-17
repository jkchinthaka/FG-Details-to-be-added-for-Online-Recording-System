import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // The app's tsconfig sets jsx: "preserve" (Next.js/SWC handles the actual
  // transform at build time) — Vitest has no such downstream step, so it
  // needs esbuild to compile JSX itself via the automatic runtime here.
  esbuild: {
    jsx: "automatic",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  test: {
    environment: "jsdom",
    env: {
      NODE_ENV: "development",
    },
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
});
