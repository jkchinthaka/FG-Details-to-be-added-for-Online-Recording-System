import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <PlaceholderPage
      eyebrow="Insights"
      title="Reports"
      description="Trends across cleaning, freezer truck and future record types for supervisors and auditors."
      emptyTitle="Reporting arrives with the database phase"
      emptyDescription="Once records persist to PostgreSQL, this screen will surface completion rates, failure trends and export options."
    />
  );
}
