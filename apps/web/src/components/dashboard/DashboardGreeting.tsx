"use client";

import { useEffect, useState } from "react";
import { formatDashboardDate, greetingForHour } from "@/lib/dashboard/format";

/** Greeting + current date for the "Today's Tasks" header. Computed client-side
 *  (not from the API) to always reflect the operator's own device clock. */
export function DashboardGreeting({ firstName }: { firstName: string | null }) {
  // Avoids a server/client render mismatch: server has no notion of "now"
  // that matches the browser's timezone, so we resolve the real value on mount.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const greeting = greetingForHour(now?.getHours() ?? 12);

  return (
    <div>
      <p className="text-nelna-primary text-xs font-semibold uppercase tracking-[0.14em]">
        {now ? formatDashboardDate(now) : "\u00A0"}
      </p>
      <h1
        className="text-nelna-primary-dark mt-1 text-[1.55rem] leading-tight sm:text-[1.75rem]"
        style={{ fontFamily: "var(--nelna-font-display)" }}
      >
        {greeting}
        {firstName ? `, ${firstName}` : ""}
      </h1>
    </div>
  );
}
