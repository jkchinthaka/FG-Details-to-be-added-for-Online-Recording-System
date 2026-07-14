import type { Metadata } from "next";
import { PageHeader } from "@nelna/ui";
import { CorrectiveActionsWorkspace } from "@/components/corrective-actions/CorrectiveActionsWorkspace";

export const metadata: Metadata = {
  title: "Corrective Actions",
};

export default function CorrectiveActionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader
        eyebrow="Food safety"
        title="Corrective Actions"
        description="Track failures from inspection through assignment, completion, verification, and closure."
      />
      <CorrectiveActionsWorkspace />
    </div>
  );
}
