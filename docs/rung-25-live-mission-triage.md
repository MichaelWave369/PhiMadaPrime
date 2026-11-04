# Rung 25 · Live GitHub Mission Triage (Opt-in)

## A useful fleet operation, not another proof of the proof

R24's actual [live R20 handoff](https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/41771811191) succeeded on **8/8 checks**, including independent examination of the original R19 ZIP and its historical source. That confirms the paperwork can be trusted *within its strictly bounded scope*. Time to improve the live operator workflow.

R25 adds a **Check live GitHub** button to each proposed task in **Mission Board**. The user can now inspect the exact GitHub branch HEAD, recent workflow conclusions and current open pull requests **in place**, before deciding which project deserves attention.

## Actual behavior

- No bulk scans or background surveillance. **Nothing is fetched until the operator selects a mission's Check live GitHub button.** One click calls the **existing**, owner/ID-validated `fetchRepoSignals(repo)` via the same code path used by the office desk inspector. If the same repo has multiple mission proposals, one in-memory observation can serve all of them.
- It queries the *public* GitHub REST API and checks repository identity before accepting its branch, run and PR results. A complete call uses four GET requests (repository metadata, default branch, recent workflow runs, first page of open PRs). No tokens, POST, merges, deployments or worker dispatches.
- The mission card displays **current observed HEAD** (truncated only in the visual display), **whether the Agentora proposal's recorded SHA matches it**, **exact-HEAD workflow observation**, and the number of observed open PRs. The first three safe, same-repository PR links can be opened for manual inspection.
- If the proposal's source SHA differs, it explicitly says **MOVED / REVIEW PLAN AGAIN**. This is a planning stale-source warning, not an assertion of broken code.
- A matching SHA is *not* a release acceptance certificate. Even if recent exact-HEAD GitHub checks are observed green, the UI says **required checks and functional completion remain unverified**.
- No signal, malformed/untrusted signal, stale signal (older than 15 minutes), or public API/rate-limit error all fail closed to **not inspected / untrusted / stale / unavailable**. It never silently displays the previous green as current.
- A first page of ten open PRs is labeled **partial**. The button can be used again to refresh; nothing is stored to disk or sent to Agentora.

## How to use

Visit [PhiMada Prime](https://michaelwave369.github.io/PhiMadaPrime/) → **Mission Board**. On a proposed job for a real public repository, click **Check live GitHub** inside its card. Review the observed GitHub HEAD against the Agentora plan, the bounded workflow result, and any open PRs before choosing a desk or manually assigning further work.

This feature is only visible for actual plan proposals. A missing Agentora plan cannot be fabricated to invent work. The proposed job remains review-only; no command is dispatched.

## Trust and implementation

Uses `src/mission-live-triage.mjs` as a small immutable parser of live signal observations and verifies repository full-name, numeric ID, observed source, false authority flags, strict SHA and 15-minute freshness. Open PR links are verified to be literal `https://github.com/MichaelWave369/<name>/pull/<number>` for that exact mission repository. No arbitrary redirect URL from the GitHub response is trusted as a button destination.

The existing `src/signals.mjs` strict repository identity, branch, workflow and PR parsing remain unmodified.

No new GitHub Actions dispatch, no credentials, new backend, server, scheduled watcher or license. It is deliberately a browser-session operator tool. No change to the R19/R20/R24 provenance chain.

Automated checks: `node --test tests/mission-live-triage.test.mjs` (12 tests). Existing project tests, build and R21 isolated Chromium Council preview remain CI-required.

**Current signal ≠ product complete. Observed CI ≠ permission to merge.**
