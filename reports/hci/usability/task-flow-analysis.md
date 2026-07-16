# Task flow analysis

| Workflow | Old clicks (baseline) | New clicks | Error prevention | Keyboard | Mobile | Human validation |
| --- | --- | --- | --- | --- | --- | --- |
| First password change | ~8 (nav distraction) | ~5 focused | Live requirements, strength, confirm match | Tab + Enter | 320px layout | HUMAN_APPROVAL_REQUIRED |
| Forced password → tasks | Loop risk | 0 loops | Middleware + chromeless | N/A | N/A | Automated unit tests |
| Template preview reset | Unclear | Confirm dialog | Unsaved leave warning | Esc closes dialog | Sticky toolbar wraps | HUMAN_APPROVAL_REQUIRED |
| Supervisor check queue | Existing | Existing | Existing review workspace | Existing | Bottom nav | HUMAN_APPROVAL_REQUIRED |
| Admin landing after PW | /tasks (wrong) | /admin for SYSADMIN | Role landing helper | N/A | N/A | Unit tested |

Baselines estimated from prior shell behaviour; formal stopwatch study remains HUMAN_APPROVAL_REQUIRED.
