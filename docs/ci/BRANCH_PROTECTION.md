# FG-CI-001 — Branch protection (external configuration)

These settings are configured in the **GitHub repository UI / API**, not in
application code. CI workflow success alone does not enforce merge rules until
branch protection requires the checks below.

## Required status checks

Protect `develop` and `main`. Require the following checks to pass before merge:

| Check name (job) | Mandatory |
| --- | --- |
| `Quality (format · lint · typecheck · unit · prisma · builds)` | Yes |
| `MongoDB integration (replica set · fg_online_test)` | Yes |
| `Playwright E2E + accessibility smoke` | Yes |
| `CI PASS` | Yes |

Optional but recommended:

| Check name | Notes |
| --- | --- |
| `Deploy gate (requires CI PASS)` | Present on `develop` / `main` pushes; confirms deploy may proceed |

## Recommended protection rules

1. **Require a pull request before merging** into `develop` and `main`.
2. **Require status checks to pass** — select the four mandatory checks above.
3. **Require branches to be up to date** before merging.
4. **Do not allow bypass** for administrators on production (`main`) except break-glass.
5. **Block force pushes** and **block branch deletion** for `main` (and prefer for `develop`).
6. **Restrict who can push** to `main` to release owners only.

## Deployment coupling

- Render / Cloudflare deploys must only promote commits whose GitHub Actions
  workflow `CI` concluded with **success** (including the `CI PASS` job).
- Do not deploy from cancelled or failed runs.
- CI never uses production databases or credentials (`fg_online_test` only).

## Node / pnpm enforcement

| Surface | Pin |
| --- | --- |
| `package.json` `engines.node` | `>=22.16.0 <22.17.0` (22.16.x) |
| `package.json` `packageManager` | `pnpm@9.12.0` |
| `.node-version` | `22.16.0` |
| CI `NODE_VERSION` | `22.16.0` |
| Render `NODE_VERSION` | `22.16.0` |

Enable Corepack locally: `corepack enable` then `corepack prepare pnpm@9.12.0 --activate`.

## Artifact policy

Upload only: JUnit / JSON test results, coverage, Playwright traces/screenshots
on failure, sanitized reports under `reports/ci/`.

Never upload: `.env*`, databases, tokens, cookies, production data dumps.
