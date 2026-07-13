"use client";

import { Alert, Button } from "@nelna/ui";
import { useAuth } from "@/lib/auth/auth-context";
import { useTodaysTasks } from "@/lib/dashboard/useTodaysTasks";
import { AdminShortcutsSection } from "./AdminShortcutsSection";
import { ComplianceIndicatorsSection } from "./ComplianceIndicatorsSection";
import { DashboardGreeting } from "./DashboardGreeting";
import { DashboardSummaryBar, DashboardSummaryBarSkeleton } from "./DashboardSummaryBar";
import { QuickActionsSection } from "./QuickActionsSection";
import { RecentRecordsSection } from "./RecentRecordsSection";
import { TaskCardsSection, TaskCardsSectionSkeleton } from "./TaskCardsSection";

/**
 * "Today's Tasks" mobile dashboard — the primary operator home screen.
 * Renders the role-aware union of widgets the API decides to send back
 * (own assignments, supervisor/QA queues, compliance indicators, admin
 * shortcuts); every widget degrades independently instead of a single
 * all-or-nothing page (see docs/records.md).
 */
export function TasksDashboard() {
  const auth = useAuth();
  const resource = useTodaysTasks();
  const roles = auth.user?.roles ?? [];
  const firstName = auth.user?.fullName?.split(" ")[0] ?? null;

  return (
    <div className="space-y-5">
      <DashboardGreeting firstName={firstName} />

      {resource.status === "loading" ? (
        <>
          <DashboardSummaryBarSkeleton />
          <TaskCardsSectionSkeleton />
        </>
      ) : null}

      {resource.status === "error" ? (
        <Alert tone="danger" title="Couldn't load today's tasks">
          <p>{resource.error}</p>
          <Button variant="secondary" className="mt-3" onClick={resource.retry}>
            Retry
          </Button>
        </Alert>
      ) : null}

      {resource.status === "success" ? (
        <>
          <DashboardSummaryBar summary={resource.data.summary} />
          <TaskCardsSection tasks={resource.data.tasks} />
          <ComplianceIndicatorsSection indicators={resource.data.complianceIndicators} />
          <AdminShortcutsSection shortcuts={resource.data.adminShortcuts} />
        </>
      ) : null}

      <QuickActionsSection roles={roles} />
      <RecentRecordsSection />
    </div>
  );
}
