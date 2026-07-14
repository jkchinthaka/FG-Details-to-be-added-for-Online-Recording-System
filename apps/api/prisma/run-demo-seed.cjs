/**
 * Local/demo-only seed entrypoint.
 * Sets ENABLE_DEMO_SEED=true then runs the normal seed script.
 * Refuses to run when NODE_ENV=production (enforced again inside seed.ts).
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

if (process.env.NODE_ENV === "production") {
  console.error("Refuse: prisma:seed:demo cannot run when NODE_ENV=production");
  process.exit(1);
}

process.env.ENABLE_DEMO_SEED = "true";
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["ts-node", "--transpile-only", path.join(__dirname, "seed.ts")],
  { stdio: "inherit", env: process.env, shell: true },
);
process.exit(result.status ?? 1);
