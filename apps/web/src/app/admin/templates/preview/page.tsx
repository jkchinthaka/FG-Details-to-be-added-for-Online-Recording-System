import type { Metadata } from "next";
import { AdminTemplatesPreview } from "./AdminTemplatesPreview";

export const metadata: Metadata = {
  title: "Checklist Templates — Preview",
};

/** Admin checklist template preview — see AdminTemplatesPreview for the
 *  permission gate (templates:manage / templates:publish) and data loading. */
export default function AdminTemplatesPreviewPage() {
  return <AdminTemplatesPreview />;
}
