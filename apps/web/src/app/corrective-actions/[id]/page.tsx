import type { Metadata } from "next";
import { CorrectiveActionDetailView } from "@/components/corrective-actions/CorrectiveActionDetailView";

export const metadata: Metadata = {
  title: "Corrective Action",
};

export default async function CorrectiveActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <CorrectiveActionDetailView id={id} />
    </div>
  );
}
