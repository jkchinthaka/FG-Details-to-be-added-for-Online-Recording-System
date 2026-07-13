import type { Metadata } from "next";
import { InspectionRecordWorkspace } from "@/components/records/InspectionRecordWorkspace";

export const metadata: Metadata = {
  title: "Daily Cleaning Verification",
};

type CleaningRecordPageProps = {
  searchParams: Promise<{ assignmentId?: string }>;
};

/**
 * Creates (or resumes) today's Daily Cleaning Verification draft and runs
 * the operator through Mark All Acceptable → Review → Submit. When opened
 * from a Today's Tasks card, `assignmentId` links the new draft back to that
 * assignment so the dashboard reflects live progress.
 */
export default async function CleaningRecordPage({ searchParams }: CleaningRecordPageProps) {
  const { assignmentId } = await searchParams;
  return <InspectionRecordWorkspace assignmentId={assignmentId ?? null} />;
}
