# FG-DEP-001 — Release build alignment

## Goal

Prove that the Cloudflare frontend/Worker and the Render API run the **same
authorized Git commit**. The authoritative release id is the full 40-character
Git SHA — never a random Next.js / OpenNext build id.

## Manifest design (safe fields only)

```json
{
  "commitSha": "40-char hex",
  "shortSha": "first 12 of commitSha",
  "buildId": "equals shortSha",
  "applicationVersion": "1.0.0",
  "environment": "production|uat|development|test",
  "builtAt": "ISO-8601",
  "deployedAt": "ISO-8601|null",
  "service": "nelna-fg-api|fgdetails"
}
```

Never includes secrets, hostnames, credentials or database URLs.

## Endpoints

| Service | Endpoint |
|---------|----------|
| Render API | `GET /health/release` (also `buildId`/`commitSha` on `GET /health`) |
| Cloudflare Worker | `GET /release` and static `GET /release-manifest.json` |

## Generate / verify

```bash
# From a clean checkout of the authorized commit:
pnpm release:generate-manifest

# After both services are deployed:
EXPECTED_COMMIT_SHA=$(git rev-parse HEAD) \
FRONTEND_PUBLIC_URL=https://<worker> \
API_PUBLIC_URL=https://<render> \
pnpm release:verify-alignment
```

## Build injection

- **Render** (`render.yaml`): build exports `GIT_COMMIT_SHA` / `APP_BUILD_ID`
  from `RENDER_GIT_COMMIT` (or `git rev-parse HEAD`) before compile.
- **Cloudflare**: `pnpm --filter @nelna/web deploy` generates the manifest and
  deploys with `--var GIT_COMMIT_SHA:<sha> --var APP_BUILD_ID:<sha>`.
- **CI**: uploads `reports/release/release-manifest.json` as an artifact.

## Support UI

System status shows a shortened **Release ID** (`shortSha`) for quoting in
support tickets.
