import { ConflictException, NotFoundException } from "@nestjs/common";

export class MasterDataNotFoundException extends NotFoundException {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" was not found`);
  }
}

export class MasterDataCodeConflictException extends ConflictException {
  constructor(entity: string, code: string) {
    super(`${entity} with code "${code}" already exists`);
  }
}

/** Prisma's unique-constraint violation code — see master-data.service.ts. */
export const PRISMA_UNIQUE_CONSTRAINT_CODE = "P2002";
