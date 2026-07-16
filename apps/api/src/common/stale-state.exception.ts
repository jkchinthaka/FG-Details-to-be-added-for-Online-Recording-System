import { ConflictException } from "@nestjs/common";

/** Concurrent / lost-update: another actor already claimed this transition. */
export class StaleStateException extends ConflictException {
  constructor(
    message = "This record was changed by someone else. Refresh and try again.",
  ) {
    super({ code: "STALE_STATE", message });
  }
}
