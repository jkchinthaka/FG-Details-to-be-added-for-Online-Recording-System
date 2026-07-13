import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const metadata: Metadata = {
  title: "Corrective Actions",
};

export default function CorrectiveActionsPage() {
  return (
    <PlaceholderPage
      eyebrow="Food safety"
      title="Corrective Actions"
      description="A single view of every failure that needs follow-up, owned by the Food Safety Team Leader."
      emptyTitle="Corrective action tracking is on the way"
      emptyDescription="Failures already surface inline on cleaning and freezer truck records. A dedicated tracking and closure workflow lands with the operator workflow phase."
    />
  );
}
