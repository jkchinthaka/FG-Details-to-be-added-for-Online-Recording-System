# Nelna design system (HCI)

Preserves Nelna Farm brand colours and operational clarity for factory users.

## Brand tokens (`packages/ui/src/styles/tokens.css`)

| Token | Role |
| --- | --- |
| `--nelna-primary` / `--nelna-primary-dark` | Primary / dark green |
| `--nelna-primary-light` / supporting greens | Surfaces and accents |
| `--nelna-gold` | Accent (CTAs, badges) |
| `--nelna-cream` | Page background |
| `--nelna-white` / surfaces | Cards and panels |
| `--nelna-text-primary` / secondary / muted | Typography |
| `--nelna-success` / warning / danger / information | Status |
| `--nelna-border` / shadows / focus ring | Structure and a11y |
| `--nelna-touch-comfortable` (44px) / `--nelna-touch-min` (48px) | Touch targets |

## Typography

- Display: Fraunces (`--nelna-font-display`) for page titles
- Body: Source Sans 3 (`--nelna-font-sans`)
- Scale: `--nelna-text-xs` … `--nelna-text-xl` with tight/normal line heights

## Components

Prefer `@nelna/ui` exports: `Button`, `Input`, `Select`, `Alert`, `Modal`, `ConfirmationDialog`, `FormErrorSummary`, `PageHeader`, `EmptyState`, `LoadingState`, `Skeleton`, `Toast`, checklist renderer family.

Internal preview: `/dev/ui` (protected in production builds if gated).

## Motion

Use only subtle transitions (`--nelna-transition-fast`). Respect `prefers-reduced-motion`.

## Do not

- Introduce purple/indigo default AI themes
- Replace Nelna greens/gold/cream
- Use icon-only actions without accessible names
- Ship decorative animation on production-floor screens
