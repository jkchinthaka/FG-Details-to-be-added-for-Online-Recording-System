import { AppShell } from "@/components/AppShell";
import { ReviewQueueWorkspace } from "@/components/records/ReviewQueueWorkspace";

export default function PendingVerificationPage() {
  return (
    <AppShell>
      <ReviewQueueWorkspace mode="verify" />
    </AppShell>
  );
}
