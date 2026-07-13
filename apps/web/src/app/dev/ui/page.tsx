import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiShowcase } from "./UiShowcase";

export const metadata: Metadata = {
  title: "UI Showcase (dev)",
};

/** Internal component gallery. Only reachable outside production builds. */
export default function DevUiShowcasePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <UiShowcase />;
}
