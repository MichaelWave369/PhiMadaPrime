# R31 · Agentora Execution Provenance in Chronicle

## What is actually new

R31 integrates the **existing** Agentora Autonomous Turn R1 GitHub-backed return verifier into PhiMadaPrime's **R29 Chronicle → R30 Evidence Nervous System**. It does not invent a second receipt format or claim to have field-qualified Agentora's entire hosted worker pipeline.

Chronicle can select a commit in the public `MichaelWave369/Agentora` history, load R30's matching PR/CI evidence, and run an explicit, scoped **Verify R1 return** operation for a numeric Agentora R1 task PR. Results display only when the existing `readTurnResult` verifies trusted GitHub records *and* the resulting tested PR SHA or verified merge SHA matches the chosen historical commit.

## How to use

1. Open **Mission Board → Agent Flow + Chronicle** and select **Agentora** from public fleet projects.
2. Click **Load branches**, select **main**, then **Load commit history**.
3. Select an exact commit associated with an Agentora Autonomous Turn R1 PR (usually its trusted squash merge SHA on `main`).
4. Under **R30 Evidence Nervous System**, click **Inspect PR + CI evidence**.
5. In **Agentora execution provenance**, choose a GitHub-associated PR candidate or enter the numeric Agentora R1 task PR number. Candidates are only hints, *not* proof. You may enter a PR not present on the bounded R30 page.
6. Click **Verify R1 return against this Chronicle SHA**. The browser calls the pre-existing strict, GET-only Agentora `readTurnResult` verifier and then checks the selected Chronicle commit/parent, R30 observation binding, return repository identity, source/tested/merge SHA and R1 state.
7. A successful correlation shows owner approval, verified controller workflow/jobs, named required CI checks, merge readback if merged, outstanding acceptance, task ID, PR and trusted run links. You may copy a read-only R31 handoff.
8. If no unique check-based return exists, authorization is missing, CI is incomplete, the selected SHA is just the *task input* or unrelated, or an API is unavailable, the result is **HELD**, not a green badge.

## Existing authenticated GitHub evidence reused

The pre-existing `src/autonomous-turn.mjs/readTurnResult` verifies the fixed numeric Agentora repository identity, the task digest and check-run metadata on exact PR HEAD, original R1 workflow identity, GitHub-owned owner-review record with exact `APPROVE <task digest>`, completed merge-gate job, named backend Python 3.12/3.13 and web CI checks, CI workflow identities, and independent PR/merge commit readback. It also rereads the PR to detect a moved HEAD. These are real GitHub metadata corroborations, not unverified JSON assertions.

R31's new `src/turn-provenance.mjs` then rejects source SHA as output evidence and accepts only:

- **VERIFIED_TESTED_PR_HEAD**: the Chronicle commit exactly equals the tested PR SHA validated by R1.
- **VERIFIED_MERGE_COMMIT**: the Chronicle commit exactly equals the independently read-back merge SHA from an R1 result in `MERGED` state.

It is scoped to the known `MichaelWave369/Agentora` repo ID. All other fleet repositories show a visible unsupported state, not a fabricated agent identity. No PR lookup or execution occurs automatically.

## Critical trust boundaries

- R1's initial bounded worker is **deterministic preapproved editing**. No model invocation or identifiable AI model is established by these records. `agentIdentityAuthenticated=false` and `aiModelExecutionProven=false` remain mandatory.
- These records can corroborate GitHub Actions / environment owner approvals and tested commits; they do not cryptographically establish who physically operated a machine or who authored an AI-generated change.
- **MERGED** is not **PRODUCT VERIFIED COMPLETE**. Human and device acceptance stay open. R31 never grants browser approval, Git write, task dispatch, environment review or merge authority.
- The unsigned R0.3 request and intake receipt remains a separate **0 independent checks run** lineage lane (R27/R30). It does not authorize R1 or become worker execution proof.
- GitHub's current live data can change. No result is silently persisted; changing the selected commit resets the R30/R31 component and its state.
- If the underlying R1 result checker lacks complete or current evidence, it throws a `TURN_...` refusal. R31 never relaxes those checks or falls back to user-supplied receipt strings.

## Source and tests

- `src/turn-provenance.mjs`: pure Chronicle/R30 SHA binding, typed allowed state checks, selection relation and bounded read-only handoff.
- `src/turn-provenance.jsx` + CSS: Agentora-only UI embedded inside R30's dedicated execution provenance card.
- `tests/turn-provenance.test.mjs`: positive fixture correlations, wrong SHA/repository/PR refusal, source-only refusal, no premature merge attribution, explicit no-acceptance claims and errors. The existing `tests/autonomous-turn.test.mjs` independently tests the strict GitHub API verifier, including negative forged approval/check/CI cases.
- No new runtime dependencies, credentials, GitHub permissions, worker or action workflows.

### Acceptance checklist

- `npm test` and `npm run build` must pass on the PR's final exact head.
- Existing isolated Chromium checks must remain green; those checks do not automatically constitute R31 UI acceptance.
- Manually on deployed Pages choose Agentora and a known R1 tested or merged commit; inspect R30 then run R31 against its correct task PR. Confirm trusted links, exact SHA relation and any outstanding acceptance.
- Try an unrelated PR, the task's source SHA, pending/held turn, non-Agentora repo, and API failures. Every one must fail closed or report unsupported.
- Check keyboard navigation and narrow viewport.

## Future scope

A future Agentora evidence contract could bind independently authenticated *agent runtime identity*, execution attestation and reproducible artifacts to a fleet repo's output SHA. That requires actual producer authentication, replay protection, scoped authorization and host security assumptions. R31 deliberately does not pretend existing GitHub check runs alone can provide those guarantees.
