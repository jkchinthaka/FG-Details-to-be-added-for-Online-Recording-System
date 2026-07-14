import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
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
    super(
      "This record has already been submitted and can no longer be edited by the operator.",
    );
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

/** Thrown when a vehicle id supplied on a truck draft doesn't resolve to a
 *  known Vehicle. */
export class VehicleNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Vehicle "${id}" was not found`);
  }
}

/** Thrown when manual freezer truck/vehicle number entry is attempted by a
 *  user without the `vehicles:manual_entry` permission. */
export class ManualVehicleEntryForbiddenException extends ForbiddenException {
  constructor() {
    super(
      "You do not have permission to enter a vehicle manually — select one from the vehicle list instead.",
    );
  }
}

/** Thrown by the loading-decision approval endpoint for a record that isn't
 *  a freezer truck inspection (no `truckDetail`). */
export class NotATruckInspectionException extends BadRequestException {
  constructor(id: string) {
    super(`Inspection record "${id}" is not a freezer truck inspection`);
  }
}

/** Thrown when the requesting user holds none of the roles allowed to
 *  record a final loading decision (defense-in-depth alongside the
 *  `@Roles()` guard). */
export class LoadingDecisionForbiddenException extends ForbiddenException {
  constructor() {
    super("Only a supervisor or QA executive may record the final loading decision");
  }
}

/** Thrown when attempting to override a critical-failure recommendation
 *  (`LOADING_BLOCKED`) with an "approved" outcome — the one business rule
 *  no human, including a supervisor/QA, may override. */
export class CriticalFailureOverrideException extends ConflictException {
  constructor() {
    super(
      "A critical failure was recorded — loading cannot be approved until it is resolved and re-inspected.",
    );
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

export class InvalidWorkflowTransitionException extends ConflictException {
  constructor(from: string, action: string) {
    super(`Cannot perform ${action} from status ${from}`);
  }
}

export class WorkflowCommentRequiredException extends BadRequestException {
  constructor(action: string) {
    super(`A comment is required for ${action}`);
  }
}

export class WorkflowSegregationOfDutyException extends ForbiddenException {
  constructor(reason: string) {
    super(reason);
  }
}

export class DuplicateWorkflowApprovalException extends ConflictException {
  constructor(action: string) {
    super(`This record has already been processed for ${action}`);
  }
}

export class WorkflowPermissionForbiddenException extends ForbiddenException {
  constructor(action: string) {
    super(`You do not have permission to ${action} this record`);
  }
}
