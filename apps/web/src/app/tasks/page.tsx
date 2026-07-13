import type { Metadata } from "next";
import { TasksDashboard } from "@/components/dashboard/TasksDashboard";

export const metadata: Metadata = {
  title: "My Tasks",
};

export default function TasksPage() {
  return <TasksDashboard />;
}
