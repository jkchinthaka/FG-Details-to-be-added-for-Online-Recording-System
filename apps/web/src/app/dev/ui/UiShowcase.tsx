"use client";

import { useState, type ReactNode } from "react";
import type { CheckItemResult } from "@nelna/shared";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ChecklistResultToggle,
  Drawer,
  EmptyState,
  IconButton,
  Input,
  LoadingState,
  MarkAllAcceptableBar,
  Modal,
  NelnaButton,
  PageHeader,
  ProgressIndicator,
  Select,
  SegmentedStatusSelector,
  Skeleton,
  StickyMobileActionBar,
  TaskStatusBadge,
  Textarea,
  useToast,
  type SegmentedStatusOption,
} from "@nelna/ui";

const BUTTON_VARIANTS = ["primary", "secondary", "ghost", "danger", "gold"] as const;

const RESULT_OPTIONS: Array<SegmentedStatusOption<CheckItemResult>> = [
  { value: "ACCEPTABLE", label: "Acceptable", tone: "success" },
  { value: "FAIL", label: "Fail", tone: "danger" },
];

const SHIFT_OPTIONS = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "NIGHT", label: "Night" },
];

export function UiShowcase() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [segmentValue, setSegmentValue] = useState<CheckItemResult | null>(null);
  const [checklistValue, setChecklistValue] = useState<CheckItemResult | null>(null);
  const [progress, setProgress] = useState(60);
  const [notifyChecked, setNotifyChecked] = useState(false);

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        eyebrow="Internal · development only"
        title="Nelna UI showcase"
        description="Every packages/ui component in one place. This route is not reachable in production builds."
      />

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <IconButton icon={<span aria-hidden>+</span>} label="Add item" />
          <IconButton icon={<span aria-hidden>+</span>} label="Add item" variant="solid" />
          <NelnaButton variant="gold">Legacy NelnaButton alias</NelnaButton>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Freezer truck number"
            placeholder="FT-12"
            hint="Auto-uppercased on submit"
          />
          <Input label="Vehicle number" error="Enter vehicle number" />
          <Select label="Shift" placeholder="Select shift" options={SHIFT_OPTIONS} />
          <Textarea label="Corrective action" hint="Only required after a Fail" rows={3} />
        </div>
        <div className="mt-4">
          <Checkbox
            label="Notify supervisor on submit"
            checked={notifyChecked}
            onChange={(event) => setNotifyChecked(event.target.checked)}
          />
        </div>
      </Section>

      <Section title="Segmented status selector">
        <SegmentedStatusSelector
          label="Wall"
          value={segmentValue}
          onChange={setSegmentValue}
          options={RESULT_OPTIONS}
        />
      </Section>

      <Section title="Cards, badges & alerts">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>Default card</Card>
          <Card muted>Muted card</Card>
          <Card interactive>Interactive card (hover me)</Card>
          <Card padding="lg">Large padding card</Card>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <Badge tone="information">Information</Badge>
          <Badge tone="gold">Gold</Badge>
        </div>
        <div className="mt-3 grid gap-2">
          <Alert tone="success" title="Verified">
            All checks passed.
          </Alert>
          <Alert tone="warning" title="Needs attention">
            One item is pending review.
          </Alert>
          <Alert tone="danger" title="Failed">
            Corrective action required.
          </Alert>
          <Alert tone="information" title="Heads up">
            Draft autosaved a moment ago.
          </Alert>
        </div>
      </Section>

      <Section title="Modal, drawer & toast">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
          <Button
            variant="gold"
            onClick={() =>
              showToast({
                tone: "success",
                title: "Saved",
                description: "Draft saved successfully.",
              })
            }
          >
            Show toast
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Example modal"
          footer={<Button onClick={() => setModalOpen(false)}>Close</Button>}
        >
          <p>Modals use a portal, close on Escape and dim the page behind them.</p>
        </Modal>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Example drawer">
          <p>Drawers power the mobile “More” navigation menu in the app shell.</p>
        </Drawer>
      </Section>

      <Section title="Loading & empty states">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton height={20} />
            <div className="mt-2">
              <Skeleton height={14} width="70%" />
            </div>
          </div>
          <LoadingState message="Loading records…" />
        </div>
        <div className="mt-4">
          <EmptyState
            title="No records yet"
            description="Records you submit will appear here."
          />
        </div>
      </Section>

      <Section title="Progress indicator">
        <ProgressIndicator value={progress} label="Checklist completion" />
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setProgress((value) => Math.max(0, value - 10))}
          >
            -10
          </Button>
          <Button
            variant="secondary"
            onClick={() => setProgress((value) => Math.min(100, value + 10))}
          >
            +10
          </Button>
        </div>
      </Section>

      <Section title="Legacy exports (kept for backward compatibility)">
        <div className="grid gap-3 sm:grid-cols-2">
          <MarkAllAcceptableBar
            itemCount={8}
            onMarkAll={() => setChecklistValue("ACCEPTABLE")}
          />
          <div className="flex flex-wrap gap-2">
            <TaskStatusBadge status="ASSIGNED" />
            <TaskStatusBadge status="IN_PROGRESS" />
            <TaskStatusBadge status="SUBMITTED" />
            <TaskStatusBadge status="VERIFIED" />
            <TaskStatusBadge status="REJECTED" />
          </div>
        </div>
        <div className="mt-3">
          <ChecklistResultToggle
            itemId="showcase-item"
            label="Sample checklist item"
            value={checklistValue}
            onChange={setChecklistValue}
          />
        </div>
      </Section>

      <StickyMobileActionBar hint="Sticky action bar demo">
        <Button fullWidth>Primary action</Button>
      </StickyMobileActionBar>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2
        className="text-lg font-semibold text-nelna-primary-dark"
        style={{ fontFamily: "var(--nelna-font-display)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
