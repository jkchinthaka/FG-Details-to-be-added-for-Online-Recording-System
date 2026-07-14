import type { Metadata } from "next";
import { FreezerTruckForm } from "@/components/FreezerTruckForm";

export const metadata: Metadata = {
  title: "Freezer Truck Inspection",
};

type FreezerTruckRecordPageProps = {
  searchParams: Promise<{ assignmentId?: string }>;
};

/**
 * Starts a new Freezer Truck Inspection Before Loading (NMS/PPU/CL/30):
 * search/select the vehicle, then Mark All Acceptable → Review → Submit.
 * When opened from a Today's Tasks card, `assignmentId` links the created
 * draft back to that assignment so the dashboard reflects live progress.
 */
export default async function FreezerTruckRecordPage({
  searchParams,
}: FreezerTruckRecordPageProps) {
  const { assignmentId } = await searchParams;
  return <FreezerTruckForm assignmentId={assignmentId ?? null} />;
}
