-- CreateEnum
CREATE TYPE "LoadingDecisionStatus" AS ENUM ('PENDING', 'APPROVED_FOR_LOADING', 'CONDITIONALLY_APPROVED', 'LOADING_BLOCKED', 'REJECTED');

-- AlterTable: InspectionRecord re-inspection linkage
ALTER TABLE "InspectionRecord" ADD COLUMN "reinspectionOfId" TEXT;

-- AlterTable: TruckInspectionDetail — transporter, load context, temperature
-- structure, and the upgraded loading-decision vocabulary.
ALTER TABLE "TruckInspectionDetail" ADD COLUMN     "transporterId" TEXT,
ADD COLUMN     "loadingReference" TEXT,
ADD COLUMN     "productCategory" TEXT,
ADD COLUMN     "temperatureCurrent" DOUBLE PRECISION,
ADD COLUMN     "temperatureMin" DOUBLE PRECISION,
ADD COLUMN     "temperatureMax" DOUBLE PRECISION,
ADD COLUMN     "temperatureAcceptable" BOOLEAN,
ADD COLUMN     "recommendedDecision" "LoadingDecisionStatus";

ALTER TABLE "TruckInspectionDetail" DROP COLUMN "temperatureReading";

ALTER TABLE "TruckInspectionDetail" ALTER COLUMN "loadingDecision" DROP DEFAULT;
ALTER TABLE "TruckInspectionDetail" ALTER COLUMN "loadingDecision" TYPE "LoadingDecisionStatus" USING ("loadingDecision"::text::"LoadingDecisionStatus");
ALTER TABLE "TruckInspectionDetail" ALTER COLUMN "loadingDecision" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "InspectionRecord_reinspectionOfId_idx" ON "InspectionRecord"("reinspectionOfId");

-- AddForeignKey
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_reinspectionOfId_fkey" FOREIGN KEY ("reinspectionOfId") REFERENCES "InspectionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckInspectionDetail" ADD CONSTRAINT "TruckInspectionDetail_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
