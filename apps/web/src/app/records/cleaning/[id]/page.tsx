import type { Metadata } from "next";
import { InspectionRecordWorkspace } from "@/components/records/InspectionRecordWorkspace";

export const metadata: Metadata = {
  title: "Cleaning Verification Record",
};

type CleaningRecordDetailPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Responsive detail view for one Daily Cleaning Verification record. Still
 * editable (via the same workspace) while it's a DRAFT/REJECTED record owned
 * by the current user; read-only for everyone else once it's been
 * submitted, matching the operator-editing lock business rule.
 */
export default async function CleaningRecordDetailPage({ params }: CleaningRecordDetailPageProps) {
  const { id } = await params;
  return <InspectionRecordWorkspace recordId={id} />;
}
