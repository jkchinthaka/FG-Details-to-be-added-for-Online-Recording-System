# Responsive results (FG-ACC-001 / FG-UI-001)

Validation targets for important routes (login, change-password, tasks, records,
template preview, review queues, admin):

| Viewport | Class | Status |
| --- | --- | --- |
| 320x568 | Small phone | Code-guarded (`min(100%, …)` frames; sticky actions) — screenshot pending |
| 360x800 | Common Android | Code-guarded — screenshot pending |
| 390x844 | iPhone-class | Template preview mobile width `min(100%, 390px)` |
| 412x915 | Large phone | Code-guarded — screenshot pending |
| 768x1024 | Tablet portrait | Sidebar + content — screenshot pending |
| 1024x768 | Tablet landscape | Sidebar + content — screenshot pending |
| 1366x768 | Laptop | Desktop layout — screenshot pending |
| 1920x1080 | Desktop | Desktop layout — screenshot pending |

Automated Playwright screenshot matrix: not executed in this window (requires
`RUN_E2E=1` + local web server). Store sanitized screenshots under
`reports/hci/screenshots/` when captured — never capture credentials.

Code overflow protections:

- Change-password form `width: min(100%, 28rem)`
- Template preview mobile frame `min(100%, 390px)`
- Sticky preview toolbar with wrap
- Sticky password / review action bars with safe-area padding
- Zoom enabled (`maximumScale` removed from root viewport)
