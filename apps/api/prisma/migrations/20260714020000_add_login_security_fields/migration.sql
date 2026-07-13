-- AlterTable: failed-login attempt counter + timed lockout + last-login timestamp
ALTER TABLE "User"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);
