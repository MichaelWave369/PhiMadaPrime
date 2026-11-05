# R33 · Fleet Failure Investigator (bounded public GitHub cohort)

## What this adds

The PhiMadaPrime Mission Board now has a separate expandable **Fleet Failure Investigator** with live, on-demand, read-only GitHub Actions evidence for up to **four manually selected public repositories per scan**.

It builds on R32 Run Observatory's job/step normalization while avoiding a misleading promise to monitor all 220+ fleet projects. A selected cohort is not the whole fleet; historical failed workflow records are not necessarily active production incidents.

## Operator workflow

1. Open **Mission Board → Fleet Failure Investigator**.
2. Filter the public fleet catalog and add up to four valid projects to the visible cohort. Only discovered, numeric-ID-matched, non-example `MichaelWave369` repositories are allowed.
3. Click **Scan historical failures**. This is the only trigger for the multi-repo scan. Each selected repository is independently verified using public GitHub metadata (numeric ID, exact owner/name, non-private) and a current default-branch HEAD ref. Then a bounded first page of at most eight GitHub workflow runs with `status=failure` is fetched.
4. Inspect the result cards. Each shows the *observed* default HEAD SHA, failing run SHA, workflow path, run attempt, event and observation time. `MATCHES OBSERVED DEFAULT HEAD` means the failing run targeted the then-current default commit. `NOT DEFAULT HEAD` means another branch or an earlier SHA: **do not infer it was fixed**.
5. Pick a run with **Investigate**, then click **Inspect failed jobs + steps**. R33 independently rereads the public repository, default HEAD and exact run. Any changed HEAD, run SHA, attempt, workflow path or conclusion requires a rescan.
6. R33 retrieves at most 50 jobs from the same run and reuses the R32 validated job/step normalizer. Explicitly failed jobs and steps are shown with official GitHub job URLs. Missing or truncated job/step data are marked partial. No logs or artifacts are downloaded.
7. Choose **Copy review-only failure handoff** to retain the observed evidence and limitations for manual triage. The handoff makes no cause, product verification or merge claims.
8. To investigate another cohort, remove or add repo chips, then explicitly scan again. No background watching, automatic scheduling, recurring alerts or git writes occur.

## Evidence and safety model

- Only a user's explicit click performs public GitHub GETs, with credentials omitted and no secrets. The app does not call GitHub workflow-dispatch, rerun, write, merge, review or deployment APIs.
- Cohort size is capped at four; the failure list is limited to eight per selected project and job list to 50. The endpoint's `status=failure` filter is specific to **conclusion failure**, excluding separate `timed_out`, `cancelled` or `action_required` categories. Those are not silently classified as passing.
- The scanner independently handles partial successes: one rate-limited or missing repository is labeled **UNAVAILABLE** without erasing valid observations for the others. Records with mismatched repository ID/full name, unsafe workflow path, wrong conclusion, duplicate ID, invalid SHA or attempt are excluded and make coverage partial.
- Exactly eight returned failures is conservatively flagged as possibly partial. Unavailable, mismatched and excluded data never produce healthy/green claims.
- The run inspect step requires the previously observed repository, run ID, exact commit SHA, path, attempt, completed/failure conclusion and unchanged default HEAD; stale evidence fails closed.
- GitHub job/step names are untrusted text metadata, not actionable instructions. No code in them is evaluated. The page presents links built from validated repository and numeric run/job IDs.
- A failure in a feature branch is not proof the default branch is broken. A run on the default SHA is not proof product operations are broken. **Root cause is not determined** from job/step labels. The operator must review actual GitHub logs and current CI with proper permissions.
- R31's trusted Agentora owner-approval provenance remains separate. General GitHub Actions metadata is not a signed agent attestation, required branch-protection audit, independent device test or AI-model identity.

## Engineering

- `src/fleet-failure-investigator.mjs`: bounded public cohort, identity checks, failure filtering, stale-run/HEAD protection, R32 job normalization, handoff.
- `src/fleet-failure-investigator.jsx`: opt-in cohort controls, partial/unavailable cards, run selection, failing steps and handoff.
- `src/fleet-failure-investigator.css`: responsive workstation styling, keyboard focus and reduced motion.
- `src/mission-board.jsx`: lazy-loaded standalone Mission Board area, independent of R29-R32 Chronicle.
- `tests/fleet-failure-investigator.test.mjs`: negative cases for wrong repository, unsafe runs, historical default-head distinction, partial pages, changed run attempts, unrelated jobs and no authority.
- No additional dependencies, GitHub permissions, runners or background polling.

## Verification

Before merge, require `npm test`, `npm run build` and the existing isolated Chromium preview on the final commit. The existing browser preview exercises its own contract, not full R33 end-to-end acceptance.

After Pages deploys, open PhiMadaPrime's Mission Board, add **PhiMadaPrime** and **Agentora**, and scan once. The public API has previously reported historical failed runs in both repositories, but results can change or be rate-limited. Inspect a known failed PhiMadaPrime R31 feature-branch run, verify its **NOT DEFAULT HEAD** label and failing test step. Try a missing/restricted repo, verify partial warning, and test mobile/keyboard controls. Historical failure presence is not a declaration of an active incident.

## Future

For real continuous fleet health, build a separately authorized, scheduled server-side collector with evidence caching, strict per-repository API budgets, backoff/rate-limit management, signed provenance where applicable and explicit false-alarm controls. A public static browser is unsuitable for unbounded periodic crawling or trusted alerting.
