-- CreateEnum
CREATE TYPE "TaskAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "areaLabel" TEXT NOT NULL,
    "shiftId" TEXT,
    "dueDate" DATE NOT NULL,
    "status" "TaskAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "recordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_recordId_key" ON "TaskAssignment"("recordId");

-- CreateIndex
CREATE INDEX "TaskAssignment_assignedToId_dueDate_idx" ON "TaskAssignment"("assignedToId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_assignedToId_templateCode_dueDate_key" ON "TaskAssignment"("assignedToId", "templateCode", "dueDate");

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "InspectionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
