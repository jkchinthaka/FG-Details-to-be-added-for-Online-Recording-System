# Accessibility report

Target: WCAG 2.2 AA

## Automated

| Suite | Result | Notes |
| --- | --- | --- |
| Middleware / password gate unit tests | PASS (when packages tested) | Redirect-loop prevention |
| Playwright HCI password-gate | SKIP unless RUN_E2E=1 | Local/UAT only |
| axe-core full crawl | PENDING / CONDITIONAL | Install and run against UAT; store `axe-results.json` |

## Manual (required for formal pass)

- Keyboard: skip link, drawer Escape, password fields  
- Screen reader smoke: change-password requirements list  
- 200% zoom on login + password + preview  

Status: **HUMAN_APPROVAL_REQUIRED** for formal accessibility acceptance.  
Technical Critical shell issues for password nav: addressed in code.
