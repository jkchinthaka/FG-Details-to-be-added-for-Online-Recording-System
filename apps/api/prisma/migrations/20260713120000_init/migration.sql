-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FG_OPERATOR', 'FG_SUPERVISOR', 'QA_EXECUTIVE', 'FOOD_SAFETY_TEAM_LEADER', 'SYSTEM_ADMINISTRATOR', 'AUDITOR');

-- CreateEnum
CREATE TYPE "WorkShift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- CreateEnum
CREATE TYPE "RecordType" AS ENUM ('DAILY_CLEANING_VERIFICATION', 'FREEZER_TRUCK_INSPECTION');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CheckItemResult" AS ENUM ('ACCEPTABLE', 'FAIL');

-- CreateEnum
CREATE TYPE "LoadingDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "freezerTruckNumber" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FgRecord" (
    "id" TEXT NOT NULL,
    "recordType" "RecordType" NOT NULL,
    "documentCode" TEXT NOT NULL,
    "shift" "WorkShift" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'SUBMITTED',
    "checkedById" TEXT,
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FgRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "recordType" "RecordType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "shift" "WorkShift" NOT NULL,
    "workDate" DATE NOT NULL,
    "areaLabel" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "recordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCleaningVerification" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    CONSTRAINT "DailyCleaningVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningCheckLine" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "result" "CheckItemResult" NOT NULL,
    "failureNote" TEXT,
    "correctiveAction" TEXT,
    CONSTRAINT "CleaningCheckLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreezerTruckInspection" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "freezerTruckNumber" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "correctiveAction" TEXT,
    "loadingDecision" "LoadingDecision" NOT NULL,
    CONSTRAINT "FreezerTruckInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreezerTruckCheckLine" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "result" "CheckItemResult" NOT NULL,
    "failureNote" TEXT,
    CONSTRAINT "FreezerTruckCheckLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Vehicle_freezerTruckNumber_key" ON "Vehicle"("freezerTruckNumber");
CREATE UNIQUE INDEX "TaskAssignment_recordId_key" ON "TaskAssignment"("recordId");
CREATE INDEX "TaskAssignment_workDate_assigneeId_status_idx" ON "TaskAssignment"("workDate", "assigneeId", "status");
CREATE UNIQUE INDEX "DailyCleaningVerification_recordId_key" ON "DailyCleaningVerification"("recordId");
CREATE UNIQUE INDEX "CleaningCheckLine_verificationId_itemId_key" ON "CleaningCheckLine"("verificationId", "itemId");
CREATE UNIQUE INDEX "FreezerTruckInspection_recordId_key" ON "FreezerTruckInspection"("recordId");
CREATE UNIQUE INDEX "FreezerTruckCheckLine_inspectionId_itemId_key" ON "FreezerTruckCheckLine"("inspectionId", "itemId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "FgRecord" ADD CONSTRAINT "FgRecord_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FgRecord" ADD CONSTRAINT "FgRecord_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "FgRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyCleaningVerification" ADD CONSTRAINT "DailyCleaningVerification_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "FgRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CleaningCheckLine" ADD CONSTRAINT "CleaningCheckLine_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "DailyCleaningVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FreezerTruckInspection" ADD CONSTRAINT "FreezerTruckInspection_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "FgRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FreezerTruckInspection" ADD CONSTRAINT "FreezerTruckInspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FreezerTruckCheckLine" ADD CONSTRAINT "FreezerTruckCheckLine_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "FreezerTruckInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
