# Navigation model

## Groups

1. Home (`/tasks`)
2. Records (`/records`, `/records/new`, record detail)
3. To Check (`/records/pending-check`)
4. To Verify (`/records/pending-verification`)
5. Corrective Actions (`/corrective-actions`)
6. Reports (`/reports`)
7. Administration (`/admin` and children)
8. Profile (`/profile`)

Items are filtered by role via `filterNavItemsByRole`.

## Shell behaviours

- Desktop: collapsible-width sidebar (icons md, labels lg) with `title` tooltips
- Mobile: bottom nav + More drawer; Escape closes drawer; focus returns to More
- Skip link: “Skip to main content” → `#main-content`
- Active route: `aria-current="page"`

## Forced password change (`mustChangePassword`)

- Middleware redirects all app routes to `/change-password`
- AppShell treats `/change-password` as chromeless (no primary nav)
- If a password-change user somehow renders authenticated chrome, PasswordChangeChrome shows brand + Sign out only
- After success, land on `postPasswordChangeLandingPath` (`/admin` for SYSTEM_ADMINISTRATOR, else `/tasks`)

## Chromeless routes

`/login`, `/change-password`, `/unauthorized`, `/account-inactive`, `/offline`
