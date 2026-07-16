# FG-DEP-001 deployment result

**Working branch:** `cursor/full-remediation-20260716-2241`  
**Commit SHA:** `5b7eb92c83f21e96ae2b7cf19b65ee5fe439f012`  
**Recorded at:** 2026-07-16T18:29Z

## Cloudflare Worker

| Item | Result |
|------|--------|
| `wrangler whoami` | Authenticated |
| Deploy | **Succeeded** — `https://fgdetails.chinthakajayaweera1.workers.dev` |
| Version ID | `0006dfa7-f052-4242-ae69-1949b5dc3224` |
| `GET /release` | `commitSha=5b7eb92c83f21e96ae2b7cf19b65ee5fe439f012` |
| `GET /release-manifest.json` | same commitSha |

Safe GET only — no secrets in payload.

## Render API

| Item | Result |
|------|--------|
| `RENDER_API_KEY` | unset |
| Render CLI | absent |
| Deploy this commit | **Not performed** |
| `GET /health/release` | **404** (endpoint not yet on live service) |
| `GET /health` | healthy; `buildId=ac85e6656ad8` (stale vs expected `5b7eb92c83f2`); no `commitSha` field |

## Alignment

| Check | Result |
|-------|--------|
| Expected SHA | `5b7eb92c83f21e96ae2b7cf19b65ee5fe439f012` |
| Worker matches expected | **PASS** |
| API matches expected | **FAIL** (stale deploy) |
| Frontend/API match each other | **FAIL** (API not updated) |

## Exact blockers

- **BLOCKED_EXTERNAL_RENDER_AUTH** — no Render API key / CLI in this environment; cannot trigger a Render redeploy of `5b7eb92`. Git auto-deploy may pick up the branch push later if the Render service tracks this branch; until then `/health/release` remains unavailable on production.

## Next operator step (Render)

1. Redeploy the Render web service from commit `5b7eb92c83f21e96ae2b7cf19b65ee5fe439f012` (or merge/auto-deploy when ready).
2. Confirm Start Command is still only `pnpm --filter @nelna/api start:prod`.
3. Re-run:
   ```bash
   EXPECTED_COMMIT_SHA=5b7eb92c83f21e96ae2b7cf19b65ee5fe439f012 \
   FRONTEND_PUBLIC_URL=https://fgdetails.chinthakajayaweera1.workers.dev \
   API_PUBLIC_URL=https://fg-details-to-be-added-for-online.onrender.com \
   pnpm release:verify-alignment
   ```
