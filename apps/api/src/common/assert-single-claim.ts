import { StaleStateException } from "./stale-state.exception";

type UpdateManyResult = { count: number };

/**
 * Asserts an atomic claim updated exactly one row; otherwise STALE_STATE 409.
 */
export function assertSingleClaim(result: UpdateManyResult): void {
  if (result.count !== 1) {
    throw new StaleStateException();
  }
}
