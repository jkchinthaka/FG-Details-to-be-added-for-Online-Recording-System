import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ChecklistValidationError } from "@nelna/shared";

export class RecordNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Inspection record "${id}" was not found`);
  }
}

export class PublishedTemplateNotFoundException extends NotFoundException {
  constructor(code: string) {
    super(`Checklist template "${code}" has no published version to record against`);
  }
}

/** Thrown by the duplicate-prevention check — a record for the same date,
 *  shift and area is already submitted/checked/verified, or is an active
 *  draft owned by another operator. */
export class DuplicateRecordException extends ConflictException {
  constructor(reason: string) {
    super(reason);
  }
}

/** Submission has already locked operator editing (status is neither DRAFT
 *  nor REJECTED) — see the "returned-correction workflow" business rule. */
export class RecordLockedException extends ConflictException {
  constructor() {
    super("This record has already been submitted and can no longer be edited by the operator.");
  }
}

export class RecordAccessForbiddenException extends ForbiddenException {
  constructor() {
    super("You do not have access to this record");
  }
}

export class InvalidRecordPayloadException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}

/** Thrown on submit when required items are unanswered, a remark/evidence/
 *  corrective-action requirement isn't met, etc. Carries the full
 *  `ChecklistValidationError[]` so the client can show exactly which items
 *  still need attention (matches the ChecklistValidationSummary shape). */
export class RecordValidationException extends BadRequestException {
  constructor(readonly errors: ChecklistValidationError[]) {
    super({
      message: "This record has validation errors and cannot be submitted",
      errors,
    });
  }
}
