# Dynamic Checklist Template Engine

A reusable engine so checklist-shaped records (NMS/PPU/CL/24 "Daily Cleaning
Verification", NMS/PPU/CL/30 "Freezer Truck Inspection", and any future form)
are driven by **template data** stored in the database, not by page-specific
rendering/validation code. Adding a new checklist form should mostly mean
authoring a new template — not writing a new page.

The engine has three layers:

- **`packages/shared/src/checklist-engine.ts`** — framework-free types, Zod
  schemas and pure logic (classification, failure detection, Mark All
  Acceptable, validation, progress). Used by both the API and the web app.
- **API (`apps/api/src/checklist-templates`)** — CRUD + versioning + publish
  lifecycle for templates, backed by the existing Prisma models.
- **UI (`packages/ui`)** — a generic renderer (`ChecklistRenderer` and its
  building blocks) that turns a template version + a response map into a
  full checklist UI, with no per-template special-casing.

## Data model

The Prisma schema already had `ChecklistTemplate` → `ChecklistTemplateVersion`
→ `ChecklistSection` → `ChecklistItem` → `ChecklistItemOption`, with
versioning (`DRAFT` / `PUBLISHED` / `ARCHIVED`) and a `currentVersionId`
pointer on the template. This work extended `ChecklistItem` — migration
`20260714030000_add_checklist_item_type_and_rules` — with:

```prisma
enum ChecklistItemType {
  PASS_FAIL_NA
  ACCEPTABLE_UNACCEPTABLE_NA
  YES_NO_NA
  SHORT_TEXT
  LONG_TEXT
  NUMBER
  TEMPERATURE
  DATE
  TIME
  SINGLE_SELECT
  PHOTO_EVIDENCE
  SIGNATURE
}

model ChecklistItem {
  // ...existing fields...
  itemType                       ChecklistItemType @default(ACCEPTABLE_UNACCEPTABLE_NA)
  isCriticalFailure              Boolean           @default(false)
  remarkRequiredOnFail           Boolean           @default(false)
  correctiveActionRequiredOnFail Boolean           @default(false)
  minValue                       Float?
  maxValue                       Float?
  defaultResponse                String?
}
```

`isRequired`, `allowNotApplicable` and `requiresEvidenceOnFail` already
existed. Together these fields are the full set of "configurable rules" the
engine understands: required, critical failure, remark/photo/corrective
action required on failure, min/max numeric bounds, N/A allowed, default
response, and display order (`sortOrder`).

## Item types

| Type | Control | Notes |
| --- | --- | --- |
| `PASS_FAIL_NA`, `ACCEPTABLE_UNACCEPTABLE_NA`, `YES_NO_NA` | Segmented status control | Share one normalized `PASS \| FAIL \| NOT_APPLICABLE` value; only the labels differ (`isStatusItemType`, `CHECKLIST_ITEM_TYPE_META`). |
| `SHORT_TEXT` / `LONG_TEXT` | Input / Textarea | Free text. |
| `NUMBER` / `TEMPERATURE` | Numeric input | Bounded by `minValue`/`maxValue`; out-of-range is treated as a failure. |
| `DATE` / `TIME` | Native date/time input | |
| `SINGLE_SELECT` | Native select | Options come from `ChecklistItemOption`. |
| `PHOTO_EVIDENCE` | `EvidenceUploader` | Photo capture *is* the response. |
| `SIGNATURE` | Name input | Captures `{ signedByName, signedAt }`. |

Only the three status types are eligible for "Mark All Acceptable" — free
text/number/date/photo/signature responses always need a human-entered value
(`isEligibleForMarkAllAcceptable`).

## Failure & critical failure detection

`isFailureResponse(item, response)` is the single source of truth for "is
this a failure":

- Status types: `value.kind === "status" && value.value === "FAIL"`.
- `NUMBER`/`TEMPERATURE`: the numeric value is outside `[minValue, maxValue]`.
- Everything else: never intrinsically a failure (a signature/photo/date is
  either present or not — see `classifyResponseStatus`).

`detectCriticalFailures`/`hasCriticalFailure` filter down to items additionally
flagged `isCriticalFailure` — the record-level "critical failure" signal the
renderer surfaces as a banner.

## Mark All Acceptable

`previewMarkAllAcceptable(items, responses)` walks every mark-all-eligible
item and buckets it as:

- **`itemIdsToFill`** — currently unanswered → will be set to the type's
  "acceptable" value (Pass / Acceptable / Yes).
- **`existingFailureItemIds`** — already `FAIL` → reported back so the UI can
  show "N items still need attention", but **never** touched.

`applyMarkAllAcceptable` applies exactly that preview and is pure (returns a
new response map; callers own state). Critically: **any item that already has
an answer — a manual failure, an N/A, or a prior acceptable — is left
completely untouched.** This is what makes it safe to call with no
confirmation dialog; it structurally cannot overwrite a recorded failure.
`clearAllResponses` is the one destructive action, and the UI (`ClearAllBar`)
gates it behind an explicit confirm modal.

## Validation

`validateChecklistResponses(sections, responses)` is a full pass over every
item, driven entirely by that item's configured rules (no template-code
special-casing):

- `REQUIRED` — required item, no answer yet.
- `NOT_APPLICABLE_NOT_ALLOWED` — answered N/A but `allowNotApplicable` is false.
- `OUT_OF_RANGE` — numeric/temperature reading outside min/max.
- `REMARK_REQUIRED` / `EVIDENCE_REQUIRED` / `CORRECTIVE_ACTION_REQUIRED` — only
  checked once an item `isFailureResponse`, and only for the rules that item
  actually has turned on.

The result also reports `criticalFailureItemIds`/`hasCriticalFailure` for the
record-level banner.

## Backend API (`apps/api/src/checklist-templates`)

All routes are versioned per template (`code` + `versionNumber`); published
versions are immutable.

| Method | Route | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/checklist-templates/published` | authenticated | List every template with a published version |
| GET | `/checklist-templates` | `templates:manage` or `templates:publish` | List all templates, including drafts |
| POST | `/checklist-templates` | `templates:manage` | Create a template (+ empty draft v1) |
| GET | `/checklist-templates/:code/published` | authenticated | Current published version, full content |
| GET | `/checklist-templates/:code/versions/:versionNumber` | authenticated for `PUBLISHED`; manage/publish for drafts | One version by number |
| GET | `/checklist-templates/:code` | `templates:manage` or `templates:publish` | Template metadata + version history |
| POST | `/checklist-templates/:code/versions` | `templates:manage` | New draft version |
| POST | `/checklist-templates/:code/versions/:versionNumber/sections` | `templates:manage` | Add a section to a draft |
| PATCH | `/checklist-templates/:code/versions/:versionNumber/sections/reorder` | `templates:manage` | Reorder a draft's sections |
| POST | `/checklist-templates/:code/versions/:versionNumber/sections/:sectionId/items` | `templates:manage` | Add an item (type + rules) |
| PATCH | `/checklist-templates/:code/versions/:versionNumber/sections/:sectionId/items/reorder` | `templates:manage` | Reorder a section's items |
| PATCH | `/checklist-templates/:code/versions/:versionNumber/items/:itemId` | `templates:manage` | Update an item's label/type/rules |
| POST | `/checklist-templates/:code/versions/:versionNumber/publish` | `templates:publish` | Publish a draft (becomes immutable) |
| POST | `/checklist-templates/:code/versions/:versionNumber/archive` | `templates:manage` or `templates:publish` | Archive a draft or published version |

Immutability is enforced server-side: every draft-mutation endpoint calls
`assertDraft()`, which throws `VersionNotEditableException` (409) for
anything not `DRAFT`. Publishing a non-draft throws `VersionNotDraftException`
(400); publishing an empty template throws `EmptyTemplateException` (400).
Item type/rule payloads are re-validated against the shared Zod schemas
(`addItemSchema` / `updateItemRulesSchema`) before hitting Prisma, so an
invalid combination (e.g. `minValue > maxValue`, or a `SINGLE_SELECT` with no
options) is rejected with `InvalidItemRulesException` (400) regardless of
what the client sent.

## Frontend renderer (`packages/ui`)

| Component | Responsibility |
| --- | --- |
| `ChecklistRenderer` | Top-level: overall progress, Mark All bar, sections, Clear All, validation summary. Fully controlled (`responses` / `onResponsesChange`). |
| `ChecklistSectionView` | One section: name, section progress, its items. |
| `ChecklistItemCard` | One item: picks the right control for `itemType`, shows the failure detail panel once failing. |
| `SegmentedStatusSelector` | Large-target Pass/Fail-style control (reused, not forked). |
| `FailureDetailPanel` | Remark / corrective action / evidence inputs — only rendered once `isFailureResponse` is true, and only marks a field "required" per that item's rules. |
| `EvidenceUploader` | Photo capture/attach; stores data URLs client-side ("UI ready" for a real upload API later). |
| `ChecklistValidationSummary` | Rolls up `ChecklistValidationError[]` into a jump-to-item list. |
| `ClearAllBar` | Destructive "start over", gated behind a confirm `Modal`. |

Low-click rules from the spec map directly onto the implementation:

- **Mark All fills only eligible unanswered items** — structural, see above.
- **Never overwrites manual failures without confirmation** — it never
  overwrites *any* answered item, full stop, so there is nothing to confirm.
- **Failure details appear only when failure selected** — `ChecklistItemCard`
  only renders `FailureDetailPanel` when `isFailureResponse` is true; flipping
  the status back to a pass does **not** delete `remark`/`correctiveAction`/
  `evidence` already on the response object (see the "no silent data loss"
  test), it just stops showing the panel.
- **Warn before destructive clearing** — `ClearAllBar` always requires an
  explicit "Clear all" confirmation in a modal.
- **Autosave-ready** — every component is a controlled component
  (`value`/`onChange` or `responses`/`onResponsesChange`); nothing owns
  hidden state, so a caller can persist `responses` on every change.

## Template preview pages (`apps/web`)

- **`/dev/templates/preview`** — development-only (mirrors `/dev/ui`'s
  `NODE_ENV` gate), lists every *published* template and renders the selected
  one through `ChecklistRenderer` at mobile/tablet/desktop widths. Good for
  quickly eyeballing a new published template.
- **`/admin/templates/preview`** — gated behind the `templates:manage` /
  `templates:publish` permissions (same ones the API enforces), lets an admin
  pick any template and any of its versions (draft or published) and preview
  it the same way, before deciding to publish.

Both pages share `apps/web/src/components/ChecklistTemplatePreview.tsx` and
`apps/web/src/lib/checklist-templates/api.ts` (a small typed fetch client for
the routes above). Responses in these preview pages are local/in-memory only
— nothing is submitted.

`/records/cleaning` (NMS/PPU/CL/24) now runs entirely on this engine end to
end: `InspectionRecordWorkspace` (`apps/web/src/components/records/`) creates
or resumes today's draft via the `inspection-records` API, renders it through
the same `ChecklistRenderer` as the preview pages, autosaves responses
(API + a localStorage backup), and walks the operator through Mark All
Acceptable → Review → Submit. The same component doubles as the record
detail view at `/records/cleaning/[id]` — read-only once the record is no
longer editable (submitted/checked/verified, or someone else's record).
`FreezerTruckForm` (NMS/PPU/CL/30) has not been migrated yet and still uses
the legacy static-item/local-draft approach.

## Adding a new checklist template

1. `POST /checklist-templates` with `{ code, title, description }` —
   creates the template and an empty draft v1.
2. `POST .../versions/:v/sections` for each section.
3. `POST .../sections/:sectionId/items` for each item, with `itemType` and
   whichever rules apply (`isRequired`, `allowNotApplicable`,
   `requiresEvidenceOnFail`, `isCriticalFailure`, `remarkRequiredOnFail`,
   `correctiveActionRequiredOnFail`, `minValue`/`maxValue`, `options` for
   `SINGLE_SELECT`).
4. `POST .../versions/:v/publish` once it looks right in
   `/admin/templates/preview`.
5. Any page using `ChecklistRenderer` against that `code`'s published version
   immediately renders the new template — no new frontend code required.

## Tests

- **`packages/shared/src/checklist-engine.test.ts`** — classification,
  failure/critical-failure detection, Mark All Acceptable (including "never
  overwrites a failure"), dynamic validation, progress.
- **`apps/api/src/checklist-templates/checklist-templates.service.spec.ts`** —
  listing/permissions, draft mutation, publish immutability (409/400 on
  editing a published version, on re-publishing, on publishing empty
  content), archive behaviour.
- **`packages/ui/src/ChecklistItemCard.test.tsx`** — failure detail
  visibility (shown only on failure, hidden on pass/unanswered), critical
  failure marker, required-vs-optional failure fields, N/A option
  hidden/shown per `allowNotApplicable`, no silent data loss when status
  flips away from `FAIL`, out-of-range numeric detection.
- **`packages/ui/src/ChecklistRenderer.test.tsx`** — Mark All Acceptable
  (fills only unanswered eligible items, leaves an existing failure with its
  remark untouched, disables once nothing is left to fill), critical failure
  banner, Clear All confirmation flow, dynamic validation summary (required
  errors, remark-required errors, and that inline/summary errors stay hidden
  until the caller opts in).
