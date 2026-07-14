import { AppShell } from "@/components/AppShell";
import { ReviewQueueWorkspace } from "@/components/records/ReviewQueueWorkspace";

export default function PendingCheckPage() {
  return (
    <AppShell>
      <ReviewQueueWorkspace mode="check" />
    </AppShell>
  );
}
