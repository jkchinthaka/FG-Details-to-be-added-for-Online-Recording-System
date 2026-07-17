/** Print only sanitized DATABASE_URL host/db flags — never credentials. */
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../../apps/api/.env");
if (!fs.existsSync(envPath)) {
  console.log("ENV_FILE: missing");
  process.exit(0);
}
const line = fs
  .readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!line) {
  console.log("ENV_FILE: no DATABASE_URL");
  process.exit(0);
}
const raw = line
  .slice("DATABASE_URL=".length)
  .trim()
  .replace(/^["']|["']$/g, "");
const hostMatch = raw.match(/@([^/]+)\//) || raw.match(/:\/\/([^/]+)\//);
const dbMatch = raw.match(/\/([^/?]+)(?:\?|$)/);
console.log("ENV_FILE_HOST=" + (hostMatch?.[1] ?? "unknown"));
console.log("ENV_FILE_DB=" + (dbMatch?.[1] ?? "unknown"));
console.log("ENV_FILE_HAS_REPLICA=" + /replicaSet=/.test(raw));
console.log("ENV_FILE_IS_LOCAL=" + /127\.0\.0\.1|localhost/.test(raw));
console.log("ENV_FILE_IS_ATLAS=" + /mongodb\.net/.test(raw));
