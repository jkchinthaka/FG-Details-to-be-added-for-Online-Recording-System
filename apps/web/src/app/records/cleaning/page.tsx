import type { Metadata } from "next";
import { DailyCleaningForm } from "@/components/DailyCleaningForm";

export const metadata: Metadata = {
  title: "Daily Cleaning Verification",
};

export default function CleaningRecordPage() {
  return <DailyCleaningForm />;
}
