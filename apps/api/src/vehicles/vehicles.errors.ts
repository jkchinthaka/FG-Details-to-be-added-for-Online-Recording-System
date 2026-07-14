import { ConflictException, NotFoundException } from "@nestjs/common";

export class VehicleNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Vehicle "${id}" was not found`);
  }
}

export class DriverNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Driver "${id}" was not found`);
  }
}

export class TransporterNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Transporter "${id}" was not found`);
  }
}

/** Duplicate vehicle number / freezer truck number / QR identifier — see
 *  AdminFleetService.createVehicle's unique-constraint catch. */
export class VehicleConflictException extends ConflictException {
  constructor(field: string, value: string) {
    super(`A vehicle with ${field} "${value}" already exists`);
  }
}

/** Duplicate driver's license number — admin is warned rather than silently overwritten. */
export class DriverLicenseConflictException extends ConflictException {
  constructor(licenseNumber: string) {
    super(`A driver with license number "${licenseNumber}" already exists`);
  }
}

export class TransporterConflictException extends ConflictException {
  constructor(name: string) {
    super(`A transporter named "${name}" already exists`);
  }
}

export const PRISMA_UNIQUE_CONSTRAINT_CODE = "P2002";
