# HCI password-gate a11y smoke (no secrets)

Runs when `RUN_E2E=1`. Does not capture credentials in screenshots.

Uses Playwright accessibility tree checks (landmarks / labels). Full axe crawl
remains conditional until `@axe-core/playwright` is added in a dedicated E2E
dependency bump.
