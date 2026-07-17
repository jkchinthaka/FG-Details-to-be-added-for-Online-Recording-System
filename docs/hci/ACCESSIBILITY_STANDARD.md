# Accessibility standard (WCAG 2.2 AA target)

## Required

- Colour contrast AA for text and UI components  
- Keyboard operation for all workflows  
- Visible focus indicators  
- Logical focus order  
- Skip link  
- Landmarks (`header`, `nav`, `main`)  
- Sensible heading hierarchy  
- Labels and descriptions for inputs  
- Error association  
- `aria-live` for status  
- Dialogs: Escape, focus trap via shared Modal/Drawer patterns  
- Icon buttons: accessible name  
- Status badges: text + tone, not colour alone  
- Support 200% zoom without loss of content  
- Honour `prefers-reduced-motion`  

## Automated evidence

- Unit/integration: Vitest where components are testable  
- E2E: Playwright gated by `RUN_E2E=1` on local/UAT  
- axe: record results under `reports/hci/accessibility/` — Critical/Serious must be fixed before `HCI_TECHNICAL_PASS`

## Human

Screen-reader smoke tests and formal sign-off remain **HUMAN_APPROVAL_REQUIRED**.
