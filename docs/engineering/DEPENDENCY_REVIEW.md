# Dependency review — Prompt 35

**Date:** 2026-07-14  
**Branch:** `develop`  
**Method:** `pnpm outdated`, `pnpm audit`, `pnpm audit --prod`  
**Policy:** Safe patch/minor only; no `audit --force`; no uncontrolled majors.

## Outdated (direct)

| Package | Current | Latest | Classification | Action |
| --- | --- | --- | --- | --- |
| `prettier-plugin-tailwindcss` | 0.6.x | 0.8.0 | Development-only; major | **Deferred** — major plugin jump; format pipeline already green on 0.6 |

## Audit summary (classified)

| Finding | Severity | Runtime / Dev | Direct / Transitive | Exploitable in this deploy? | Decision |
| --- | --- | --- | --- | --- | --- |
| `tar` via `bcrypt` → `@mapbox/node-pre-gyp` | High / Moderate | Install-time / native binding tooling | Transitive | Low on runtime API if binaries already built; higher if production image runs `npm rebuild` as non-trusted | **Accepted risk** — do not force tar majorminor override that can break bcrypt install |
| `postcss` via `next` | Moderate | Build / Next tooling | Transitive | XSS in CSS stringify — not applying untrusted CSS stringify on server as operator path | **Deferred** until Next publishes patched transitive |
| `esbuild` / `vite` via `vitest` | Moderate / High (in full audit) | Development-only | Transitive | Dev-server advisories; not production runtime | **Deferred** — Vitest 2 → Vitest 3/Vite 6 is a major test toolchain upgrade |
| Critical/high in full `pnpm audit` (dev trees) | Critical–High | Mostly toolchain | Transitive | Not applicable to production Nest/Next runtime bundle without major bumps | Documented; no suppress without reason |

## Applied in this phase

- Formatting normalized via `pnpm format` (business logic unchanged — Prettier only).
- No lockfile-breaking `overrides` or forced majors.
- No advisories suppressed in CI silently.

## Follow-ups

1. When Next.js releases a postcss ≥8.5.10 transitive, bump Next patch/minor.
2. Plan Vitest/Vite major with dedicated PR.
3. Track bcrypt / node-pre-gyp replacement (`bcryptjs` pure-JS or newer bcrypt with fixed tar) as TD item.
