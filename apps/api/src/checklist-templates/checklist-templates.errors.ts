import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

export class TemplateNotFoundException extends NotFoundException {
  constructor(code: string) {
    super(`Checklist template "${code}" was not found`);
  }
}

export class TemplateVersionNotFoundException extends NotFoundException {
  constructor(versionNumber?: number) {
    super(
      versionNumber
        ? `Checklist template version ${versionNumber} was not found`
        : "Checklist template version was not found",
    );
  }
}

export class PublishedVersionNotFoundException extends NotFoundException {
  constructor(code: string) {
    super(`Checklist template "${code}" has no published version`);
  }
}

export class SectionNotFoundException extends NotFoundException {
  constructor() {
    super("Checklist section was not found for this template version");
  }
}

export class ItemNotFoundException extends NotFoundException {
  constructor() {
    super("Checklist item was not found for this template version");
  }
}

export class TemplateCodeConflictException extends ConflictException {
  constructor(code: string) {
    super(`A checklist template with code "${code}" already exists`);
  }
}

/**
 * Published/archived versions are immutable at the application layer — see
 * docs/CHECKLIST_ENGINE.md and docs/DATABASE_DESIGN.md. Any attempt to add,
 * reorder or edit sections/items on a non-draft version lands here (409).
 */
export class VersionNotEditableException extends ConflictException {
  constructor() {
    super(
      "This template version is no longer a draft and cannot be edited. Create a new draft version instead.",
    );
  }
}

export class VersionNotDraftException extends ConflictException {
  constructor() {
    super("Only a draft version can be published");
  }
}

export class EmptyTemplateException extends BadRequestException {
  constructor() {
    super("Cannot publish a template version with no sections or items");
  }
}

export class VersionAlreadyArchivedException extends ConflictException {
  constructor() {
    super("This template version is already archived");
  }
}

export class InvalidItemRulesException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
