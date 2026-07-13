import type { Metadata } from "next";
import { FreezerTruckForm } from "@/components/FreezerTruckForm";

export const metadata: Metadata = {
  title: "Freezer Truck Inspection Record",
};

type FreezerTruckRecordDetailPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Responsive detail view for one Freezer Truck Inspection Before Loading
 * record: still editable (via the same form) while it's a DRAFT/REJECTED
 * record owned by the current user; read-only with the loading-decision
 * panel for everyone else once it's been submitted.
 */
export default async function FreezerTruckRecordDetailPage({ params }: FreezerTruckRecordDetailPageProps) {
  const { id } = await params;
  return <FreezerTruckForm recordId={id} />;
}
