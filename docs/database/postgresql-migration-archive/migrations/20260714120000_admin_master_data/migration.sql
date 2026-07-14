-- Prompt 32: admin/master-data APIs
-- Adds Vehicle.qrIdentifier plus new soft-lifecycle master-data tables.
-- No hard-delete: every new table only ever gets an `isActive` flag flipped.

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "qrIdentifier" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_qrIdentifier_key" ON "Vehicle"("qrIdentifier");

-- CreateTable
CREATE TABLE "FailureReason" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailureReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveActionCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveActionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemperatureProfile" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minCelsius" DOUBLE PRECISION NOT NULL,
    "maxCelsius" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemperatureProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadingDecisionPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadingDecisionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FailureReason_code_key" ON "FailureReason"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectiveActionCategory_code_key" ON "CorrectiveActionCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TemperatureProfile_code_key" ON "TemperatureProfile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LoadingDecisionPolicy_key_key" ON "LoadingDecisionPolicy"("key");
