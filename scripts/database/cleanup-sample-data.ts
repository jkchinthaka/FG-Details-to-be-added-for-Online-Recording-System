/**
 * TS wrapper around cleanup-sample-data.js (executable Node implementation).
 *
 *   pnpm exec ts-node --transpile-only scripts/database/cleanup-sample-data.ts --dry-run --database=fg_online
 *   node scripts/database/cleanup-sample-data.js --execute --database=fg_online
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const script = path.join(__dirname, "cleanup-sample-data.js");
const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
