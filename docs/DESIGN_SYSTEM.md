# Nelna design system

`@nelna/ui` is the single source of design tokens and reusable components for
the Nelna FG Digital Recording System. This document describes the tokens,
components, breakpoints and usage rules introduced in the "design system and
app shell" phase (see `docs/ARCHITECTURE.md`).

Nothing in this package implements business logic or complete record forms —
it only provides the building blocks. Record workflows (Daily Cleaning
Verification, Freezer Truck Inspection, and future record types) are composed
from these primitives inside `apps/web`.

## Where things live

- `packages/ui/src/styles/tokens.css` — every colour, radius, shadow and
  motion value used across the design system, plus the CSS classes that
  components attach to (`nelna-btn`, `nelna-card`, `nelna-control`, …).
  **Hex values only ever appear in this file.** Components and app code must
  reference the CSS variables instead of hard-coding colours.
- `packages/ui/src/*.tsx` — component implementations.
- `packages/ui/src/index.ts` — the public export surface.
- `apps/web/src/components/AppShell.tsx` — the responsive application shell
  that consumes the design system.
- `apps/web/src/app/dev/ui/page.tsx` — a live component gallery, available at
  `/dev/ui` only when `NODE_ENV === "development"` (it renders Next.js's
  standard not-found page in production).

## Brand colours

| Token | Hex |
| --- | --- |
| Primary Green | `#27743A` |
| Light Green | `#46AF53` |
| Dark Green | `#0D3013` |
| Gold | `#D8C76B` |
| Cream / Off White | `#EBE9DA` |
| Dark Background | `#251B25` |

These are declared once as `--nelna-primary-green`, `--nelna-light-green`,
`--nelna-dark-green`, `--nelna-gold`, `--nelna-cream` and
`--nelna-dark-background` in `tokens.css`, and `packages/shared/src/brand.ts`
mirrors the same hex values for non-CSS consumers (e.g. the PWA manifest,
`theme-color` meta tag).

## Semantic tokens

All components consume semantic tokens, never the raw brand colours directly.

| Token | Resolves to | Usage |
| --- | --- | --- |
| `--nelna-background` | Cream | Page background |
| `--nelna-surface` | White | Card / control background |
| `--nelna-primary` | Primary Green | Primary actions, links, focus ring |
| `--nelna-primary-hover` | `#1F5F30` | Hover state for primary actions |
| `--nelna-primary-active` | Dark Green | Pressed state, active nav, headings |
| `--nelna-text-primary` | `#1A1A1A` | Body text |
| `--nelna-text-secondary` | `#5C5C5C` | Secondary / muted text |
| `--nelna-border` | `#D9D5C4` | Card borders, dividers, input borders |
| `--nelna-success` | Primary Green | Success state |
| `--nelna-warning` | `#A56A00` | Warning state |
| `--nelna-danger` | `#B42318` | Failure / destructive state |
| `--nelna-information` | `#1C5F8A` | Informational state |
| `--nelna-disabled` | `#9C9C93` | Disabled text/controls |

Each status token (`success`, `warning`, `danger`, `information`) also has a
tinted `-bg` surface variant (e.g. `--nelna-success-bg`) used behind badges,
alerts and toasts.

A small set of **legacy aliases** (`--nelna-primary-light`,
`--nelna-primary-dark`, `--nelna-dark`, `--nelna-text`, `--nelna-text-muted`,
`--nelna-focus`) are kept so the Phase 1 record components
(`ChecklistResultToggle`, `MarkAllAcceptableBar`, `StickySubmitBar`,
`TaskStatusBadge`, `EmptyState`) keep working unchanged.

## Shape, sizing & motion tokens

- `--nelna-radius-sm` (8px), `--nelna-radius` (12px), `--nelna-radius-lg`
  (18px) — corner radii, from tight (badges) to spacious (modals/drawers).
- `--nelna-touch-min` (48px) and `--nelna-touch-comfortable` (44px) — minimum
  interactive target sizes. Every control in this package respects at least
  the comfortable size, and primary actions use the full 48px.
- `--nelna-shadow-sm` / `--nelna-shadow-md` — the **only** shadows in the
  system, both intentionally subtle. Do not add heavier shadows or
  decorative gradients; the brand look is flat cream/white surfaces.
- `--nelna-transition-fast` (120ms) — the standard hover/press transition.

## Components

### Actions

- **`Button`** — `variant`: `primary | secondary | ghost | danger | gold`,
  `size`: `md | lg`, plus `fullWidth`, `loading`, `leftIcon`/`rightIcon`.
  `gold` is reserved for pending/highlight actions, not general use.
- **`NelnaButton`** — deprecated alias of `Button` kept for the existing
  cleaning / freezer truck forms. New code should import `Button`.
- **`IconButton`** — icon-only control with a mandatory `label` (used as
  both `aria-label` and tooltip `title`).

### Form fields

- **`Input`**, **`Textarea`** — labelled text fields with `hint` and `error`
  slots and automatic `aria-describedby` wiring.
- **`Select`** — labelled native select with an optional placeholder option.
- **`Checkbox`** — reserved for **secondary, multi-select choices** (e.g.
  "notify supervisor"). Primary Acceptable/Fail decisions must use
  `SegmentedStatusSelector` instead — this mirrors the UX principle that
  tiny checkboxes should never be the primary control for a checklist
  result.
- **`SegmentedStatusSelector<T>`** — large-target, exception-first status
  picker. Generic over the result type so it can express Acceptable/Fail,
  Approved/Rejected, or any future status set with per-option tone
  (`neutral | success | warning | danger`).

### Surfaces & feedback

- **`Card`** — the default white operational surface. `muted` swaps to the
  cream-tinted surface, `interactive` adds hover affordance for card links,
  `padding="lg"` increases internal spacing.
- **`Badge`** — status pill with `tone`. Use `gold` sparingly, for
  pending/highlight accents only — never as a general-purpose colour.
- **`Alert`** — inline banner for validation summaries and record-level
  notices (`success | warning | danger | information`).
- **`Modal`** — centred dialog for focused decisions. Portal-rendered,
  closes on `Escape` or backdrop click.
- **`Drawer`** — off-canvas panel (`side="right" | "bottom"`). The mobile
  "More" navigation menu in `AppShell` is a bottom drawer built on this.
- **`ToastProvider` / `useToast()`** — imperative toast API. `AppShell` wraps
  every page in a single `ToastProvider`; call `useToast().showToast(...)`
  from any client component beneath it.
- **`Skeleton`** — shimmering loading placeholder for content still
  fetching.
- **`LoadingState`** — full-block spinner + message for a loading page or
  section.
- **`EmptyState`** — used for both "nothing here yet" and "coming in a
  later phase" messaging (all placeholder routes use this).
- **`ProgressIndicator`** — linear progress bar with an optional label, e.g.
  checklist completion.

### Layout

- **`PageHeader`** — eyebrow + display title + description + actions slot,
  used at the top of every page.
- **`StickyMobileActionBar`** — general-purpose sticky bottom action bar for
  new record flows and task wizards.
- **`StickySubmitBar`** — kept dedicated to the existing Phase 1 cleaning
  and freezer truck record forms; do not repurpose it for new flows, use
  `StickyMobileActionBar` instead.

### Record-specific (Phase 1, unchanged)

`ChecklistResultToggle`, `MarkAllAcceptableBar`, `TaskStatusBadge` continue to
power the existing cleaning and freezer truck forms and are re-exported
as-is.

## Application shell & breakpoints

`apps/web/src/components/AppShell.tsx` renders a single responsive shell
around every route:

| Breakpoint | Width | Navigation |
| --- | --- | --- |
| Mobile | `< 768px` | Fixed bottom navigation bar (Home, My Tasks, New Record, Records) plus a **More** button that opens a bottom `Drawer` with the remaining items (Corrective Actions, Reports, Administration, Profile) |
| Tablet | `≥ 768px` (`md`) | Compact icon-only sidebar (all 8 items, labels available via `aria-label`/`title`) |
| Desktop | `≥ 1024px` (`lg`) | Full sidebar with icons and visible labels |

A sticky top header is present at every breakpoint with the Nelna wordmark,
a notifications `IconButton` (shows a placeholder toast) and an account menu
`IconButton` (opens a small menu with a Profile link and a disabled
"Sign out" placeholder — authentication lands in a later phase).

Navigation items, in order: **Home, My Tasks, New Record, Records,
Corrective Actions, Reports, Administration, Profile**. Existing routes
(`/system-status`, `/about`, `/records/cleaning`, `/records/freezer-truck`)
remain reachable — the first two are linked from the Administration page,
the record forms are linked from Records / New Record.

## Usage rules

1. **Centralize colour** — never write a hex value outside `tokens.css`.
   Reference `var(--nelna-*)` everywhere else.
2. **Cream page background, white cards** — `--nelna-background` on `html`/
   `body`, `--nelna-surface` on `Card`. Don't introduce alternative page
   backgrounds.
3. **Gold is a controlled accent** — pending states and important highlights
   only (`Badge tone="gold"`, `Button variant="gold"`). Never use it as a
   default action colour.
4. **No heavy shadows or decorative gradients** — only `--nelna-shadow-sm`/
   `-md`, both subtle. The Skeleton shimmer is the one intentional gradient
   in the system and it exists purely to communicate a loading state.
5. **44–48px touch targets** — every interactive component defaults to
   `--nelna-touch-min` (48px); use `--nelna-touch-comfortable` (44px) only
   for secondary controls like `Checkbox`.
6. **Accessible focus** — every interactive element carries the
   `nelna-focusable` class, which draws a 3px `--nelna-focus` outline on
   `:focus-visible`. Don't remove it.
7. **No horizontal scroll on mobile** — layouts use `min-w-0` / `flex-wrap`
   and the shell caps content at `max-w-5xl`; verify new pages at 360px
   width.
8. **Checkboxes are secondary controls** — see the `Checkbox` note above.
9. **Keep `packages/ui` free of business logic** — it must only export
   generic, reusable primitives. Record-specific behaviour belongs in
   `apps/web` (or `packages/shared` for domain types/schemas).

## Testing

Component tests live next to their source in `packages/ui/src/*.test.tsx`
and use Vitest 2 (`^2.1.9` — pinned below v3 for Node 24 compatibility) with
`@testing-library/react` and a `jsdom` environment configured in
`packages/ui/vitest.config.ts`. Run them with:

```bash
pnpm --filter @nelna/ui test
```

`packages/ui/vitest.setup.ts` calls `cleanup()` after every test so DOM
queries in one test never leak into the next.

## Verifying changes to this package

```bash
pnpm --filter @nelna/shared build   # ui depends on shared's types
pnpm --filter @nelna/ui build
pnpm --filter @nelna/ui test
pnpm --filter @nelna/ui typecheck
pnpm --filter @nelna/ui lint
```

When app-facing components change, also check the consuming app:

```bash
pnpm --filter @nelna/web typecheck
pnpm --filter @nelna/web lint
pnpm --filter @nelna/web build
```
