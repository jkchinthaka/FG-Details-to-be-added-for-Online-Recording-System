import { redirect } from "next/navigation";

/** The app's root: every authenticated user lands on "Today's Tasks" — see apps/web/src/app/tasks/page.tsx. */
export default function HomePage() {
  redirect("/tasks");
}
