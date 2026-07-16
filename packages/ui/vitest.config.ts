import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  test: {
    environment: "jsdom",
    env: {
      NODE_ENV: "development",
    },
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
