# PhiMadaPrime Verified Pipeline Factory R3: Public CI Observation Bridge

R3 phase 1 adds an opt-in, read-only public GitHub observation panel to the
existing ThinkTank → Pipeline Factory. It reuses the existing fleet catalog,
fetchRepoSignals, repository identity guard, exact default-branch HEAD and
15-minute observation freshness rule. It adds no new fetch loop or token.

## Operator workflow

1. Open ThinkTank → Pipeline Factory → Real Evidence Bridge.
2. Select one actual, public MichaelWave369 repository from the loaded catalog.
3. Choose Inspect public HEAD & CI. This uses the same existing on-demand
   GitHub inspector as the repository desk. No scan occurs automatically.
4. When an observation is fresh, choose Pin observed HEAD. The SHA is now an
   explicit review target bound to the current in-memory pipeline design.
5. Refresh the repository inspection to compare current GitHub HEAD with the
   pinned SHA. A moved, missing, stale or untrusted observation is held.
6. Read the exact report, including sampling limitations and no-authority notes.

## What is and is not checked

The observation report checks current public repo identity, catalog repo ID,
origin label, observation age, exact pinned SHA and the existing classified
GitHub workflow sample for the repository's default branch.

The original signals.mjs inspector fetches up to 12 recent workflow runs.
A reported green result only says all **sampled exact-head workflows**
had successful conclusions. It does NOT establish required branch-protection
checks, exact test commands, complete run logs, signed provenance, program
behavior, successful deploys, GMED adjudication, source truth, or approval.
An HTTP API response and its origin label are not cryptographic attestation.

Reports explicitly keep required_checks_verified=false,
test_commands_replayed=false, tests_executed_in_this_app=false,
human_review_completed=false, merge_authorized=false, and permissions=[].
No model, test, worker, deploy, merge, or backend execution happens here.

This is Phase 1. GMED and WITNESS are NOT connected to the pipeline evaluator
yet. The R2 synthetic lab remains entirely separate and cannot be treated
as a real public GitHub observation.

## Tests and acceptance

Run npm test and npm run build. Review the live-evidence test module for
freshness, wrong-owner, moved-HEAD, pending, failed, fabricated and synthetic
receipt refusals. Manually test actual public GitHub inspection in desktop
and mobile browsers, then verify that R36/R37/R38 rooms and the R2 synthetic
lab remain accessible. CI green in this repository is not that manual check.

## Later phases

R3 phase 2 should add independently specified GMED and WITNESS read-only
evidence contracts, plus workflow run/job identifiers and logs with a
fresh exact commit binding. Those future steps must not infer verification
from a green status label alone.
