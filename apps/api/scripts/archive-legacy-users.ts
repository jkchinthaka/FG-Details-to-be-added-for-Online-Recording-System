/**
 * DEPRECATED unsafe archive entrypoint.
 * Delegates to the production-safe cutover script.
 * Prefer: pnpm --filter @nelna/api users:cutover:dry-run
 */
import "./cutover-users-to-username";
