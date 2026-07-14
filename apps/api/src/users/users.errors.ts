import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

export class UserNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`User "${id}" was not found`);
  }
}

export class EmployeeCodeConflictException extends ConflictException {
  constructor(employeeCode: string) {
    super(`A user with employee code "${employeeCode}" already exists`);
  }
}

export class EmailConflictException extends ConflictException {
  constructor(email: string) {
    super(`A user with email "${email}" already exists`);
  }
}

export class UnknownRoleException extends BadRequestException {
  constructor(roleName: string) {
    super(`Unknown role "${roleName}"`);
  }
}

/**
 * Guards the system against ever being left with zero active
 * SYSTEM_ADMINISTRATOR users — see docs/AUTHENTICATION.md. Blocks both
 * deactivating the last active admin and stripping their admin role.
 */
export class LastActiveAdminProtectionException extends ConflictException {
  constructor() {
    super(
      "This is the last active System Administrator. Deactivate or remove this role only after another active administrator exists.",
    );
  }
}
