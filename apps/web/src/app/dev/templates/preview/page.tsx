import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevTemplatesPreview } from "./DevTemplatesPreview";

export const metadata: Metadata = {
  title: "Checklist Template Preview (dev)",
};

/** Internal renderer preview against the live published templates. Only
 *  reachable outside production builds, mirroring /dev/ui's gating. */
export default function DevTemplatesPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <DevTemplatesPreview />;
}
