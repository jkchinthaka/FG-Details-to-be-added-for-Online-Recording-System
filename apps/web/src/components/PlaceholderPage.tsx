import type { ReactNode } from "react";
import { EmptyState, PageHeader } from "@nelna/ui";

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState title={emptyTitle} description={emptyDescription} action={action} />
    </div>
  );
}
