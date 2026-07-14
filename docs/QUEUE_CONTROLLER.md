# Master Queue Controller — Nelna FG Digital Recording System

**Owner / developer:** Chinthaka Jayaweera  
**Repository:** https://github.com/jkchinthaka/FG-Details-to-be-added-for-Online-Recording-System.git  
**Policy effective:** 2026-07-14 (queue and release correction)

This document is binding for all queued phase work. It supersedes any earlier assumption that a mid-queue phase may merge to `main` or publish `v1.0.0`.

---

## 1. Sequential execution

Complete **only one** queued phase at a time. Do **not** develop queued phases in parallel.

Before starting the next phase, confirm all of the following:

1. Current branch is `develop`
2. Working tree is clean
3. Previous phase was committed
4. Previous phase was pushed to `origin/develop`
5. Local `HEAD` matches `origin/develop`
6. Lint passed
7. Typecheck passed
8. Tests passed
9. Production build passed

If any previous phase is incomplete, broken, or unpushed, **repair and complete it** before starting a later phase.

---

## 2. Prompt 16 — release-candidate preparation only

Prompt 16 **must not**:

- Merge `develop` into `main`
- Create the `v1.0.0` tag
- Push `v1.0.0`

Prompt 16 **must**:

- Remain on `develop`
- Run full verification
- Commit completed RC preparation work
- Push **only** `git push origin develop`
- Verify local `develop` matches `origin/develop`
- Report the project as a **release candidate** pending audits, UAT, and final release approval

Canonical Prompt 16 commit message:

```text
docs: prepare FG platform release candidate
```

---

## 3. Prompt 25 — exclusive merge and tag authority

**Only Prompt 25** may:

- Approve the final go-live decision (`GO` / `CONDITIONAL GO` / `NO-GO`)
- Merge `develop` into `main`
- Push `main` (`git push origin main` — never force)
- Create the annotated `v1.0.0` tag
- Push the release tag

Do **not** create duplicate release tags.

### Historical compliance note (2026-07-14)

- `main` remained at the repository initial commit until Prompt 25.
- Annotated tag `v1.0.0` was created and pushed **once**, at Prompt 25 commit `d863abe`.
- No second `v1.0.0` tag should be created.

---

## 4. Evidence integrity

Never fabricate:

- Test results
- Performance measurements
- Security scan results
- UAT sign-off
- Production deployment
- Database backup results
- Restore-test results
- Infrastructure monitoring
- Real user feedback

When infrastructure, credentials, production access, or real users are unavailable, state exactly:

> Prepared but not executed due to unavailable production infrastructure, authorization or business user access.

Provide the exact manual verification steps instead.

---

## 5. Business decisions

Do **not** invent Nelna policies. Track unresolved decisions in `docs/requirements/OPEN_BUSINESS_DECISIONS.md`, including at minimum:

- Shift-wise versus daily record frequency
- Backdated record rules
- Photo evidence requirements
- Truck temperature requirements
- Electronic approval acceptance
- Data-retention period
- Corrective-action ownership
- Final loading authorization
- ERP or employee-master integration
- Offline operating requirements

---

## 6. Git safety

- Stay on `develop` until Prompt 25 authorizes promotion
- Never force push
- Never use `git reset --hard` unless the project owner explicitly requests it
- Do not commit secrets
- Do not commit generated build directories
- Do not stage unrelated files
- Development phases push only with:

```bash
git push origin develop
```

---

## 7. Phase completion report (required)

After every phase, report:

| Field | Content |
|-------|---------|
| Phase completed | Prompt / name |
| Branch | Must be `develop` except during authorized Prompt 25 promotion |
| Features delivered | Short list |
| Files changed | Summary |
| Migration status | None / added / applied / not applied in this env |
| Tests run | Commands |
| Test results | Pass/fail counts — real only |
| Build result | Pass/fail |
| Commit SHA | Full or short |
| Push result | `origin/develop` (and `main`/tag only if Prompt 25) |
| Local and remote HEAD comparison | Must match |
| Known limitations | Honest list |
| Business confirmations required | OBD IDs / questions |
| Next phase safe to start? | Yes / No + reason |

---

## 8. Canonical queue order

```
Existing Prompt 0–16
→ Master Queue Controller (this document)
→ Prompt 17 – Requirements Traceability
→ Prompt 18 – Architecture Audit
→ Prompt 19 – Security Review
→ Prompt 20 – Performance and Reliability
→ Prompt 21 – Database and Recovery
→ Prompt 22 – UAT and Defect Closure
→ Prompt 23 – Deployment and Monitoring
→ Prompt 24 – IT Manager Handover
→ Prompt 25 – Final Release Gate (only merge/tag authority)
```
