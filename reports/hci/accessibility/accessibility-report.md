# Accessibility report (FG-ACC-001 / FG-ACC-002)

## Before → after (technical)

| Issue | Before | After |
| --- | --- | --- |
| Forced-password chrome | Full sidebar + bottom nav visible | Chromeless / restricted identity + logout |
| Viewport zoom | `maximumScale: 1` | Zoom allowed |
| Skip link / main landmark | Missing | Present on chrome routes |
| Form errors | Ad-hoc alerts | `aria-invalid`, `aria-describedby`, `FormErrorSummary` |
| Password UX | Minimal fields | Requirements, strength, caps-lock, show/hide |
| Template preview | Basic list | Search, filters, abort/stale guards, sticky toolbar |
| Review queue | Raw item IDs / enums | Human labels, criticality, evidence, chronology |

## Axe

See `axe-results.json`. Full authenticated crawl: **pending** (`RUN_E2E=1`).

No Critical/Serious axe violations are claimed as a blanket production PASS until
the human usability review completes.

## HUMAN_USABILITY_REVIEW_REQUIRED

Operator walkthrough still required for:

1. Forced password first-login on a real temporary account
2. 200% / 400% browser zoom on change-password + template preview
3. Keyboard-only review queue and drawer “More” menu
4. Template rapid switching on tablet
