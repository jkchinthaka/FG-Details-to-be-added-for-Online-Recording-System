# Component usage guide

## Page layout

1. `PageHeader` for title + short description  
2. Inline `Alert` for page-level errors  
3. `LoadingState` / `Skeleton` while fetching  
4. `EmptyState` when there is nothing to show  
5. `ConfirmationDialog` for destructive or high-impact actions  

## Forms

- Always use a visible `label` on `Input` / `Select` / `Textarea`
- Mark required fields; keep helper text short and business-facing
- On submit failure: `FormErrorSummary` + focus the summary, then first invalid field
- Disable submit while `loading` to prevent double posts
- Preserve entered values after recoverable network errors

## Feedback

| Situation | Pattern |
| --- | --- |
| Minor success | Toast |
| Page/section error | Alert banner + Retry |
| Destructive | ConfirmationDialog |
| Offline / queue | OfflineStatusBar (`role="status"`) |
| Session expired | SessionExpiredDialog |

## Password change

Use `ChangePasswordForm` only. No application sidebar. Requirements checklist + strength meter from `@nelna/shared` `evaluatePasswordStrength`.

## Template preview

Use `AdminTemplatesPreview`. Responses are never persisted. Show the preview-mode banner.

## Accessibility checklist (authors)

- Focus visible (`nelna-focusable`)
- `aria-current="page"` on active nav
- Skip link to `#main-content`
- Touch targets ≥ 44×44 CSS px
- Announce async results with `aria-live`
