# R30: Evidence Nervous System · exact-commit PR, CI and local Agentora lineage

## Scope

R30 is a **read-only per-commit evidence bay** inside the existing R29 Agent Flow + Chronicle. It is not a new executor, PR reviewer, agent runtime, automated rollback system, or a statement of product completion. R29's branch timeline and Pierre diffs remain intact.

### Operator walkthrough

1. In PhiMadaPrime open **Mission Board → Agent Flow + Chronicle**.
2. Select a real public `MichaelWave369` repository, **Load branches**, then **Load commit history**.
3. Select any historical commit and choose **Inspect PR + CI evidence**. No requests run without this explicit click.
4. The selected SHA is checked against the current on-screen Chronicle snapshot. The app separately validates live public repository ID, owner, visibility, exact requested commit SHA and first parent before requesting other evidence.
5. GitHub provides up to **10 associated PRs**, **30 check runs** and **30 legacy status contexts**, each as an independently labeled observation. An unavailable endpoint is not silently treated as an empty list or success.
6. For an associated PR, click its GitHub link. For a check run, open the job link (only trusted `github.com/MichaelWave369/<repo>/actions/runs/<n>/job/<n>` routes are accepted).
7. Optionally expand **Agentora R0.3 request + intake receipt** and select the byte-exact original R8 JSON request and locally generated `verification-intake.json`. The existing R27 validator checks exact request SHA-256 digest and the entire strict schema, including operator/review/authority flags; R30 then requires its source SHA to match the selected historical commit. Imported files stay in React memory. They do not become remote attestations.
8. Copy an **R30 evidence-only handoff** to retain the observation time, selected SHA, PR association, check summary, legacy context state and optional local R0.3 acknowledgement. Revalidate current branch HEAD and independently required checks before taking any action elsewhere.

### Truth model

- GitHub's `GET /commits/{sha}/pulls` returns **associated PRs**, not proof that an AI agent authored them or that a particular PR review was approved. Rows are labeled `MERGE_COMMIT_SHA`, `PR_HEAD_SHA`, or `GITHUB_ASSOCIATED` based on actual verified metadata. No PR association is guessed from a matching title.
- GitHub's `GET /commits/{sha}/check-runs` returns **check-run observations**. Individual rows must match the exact selected `head_sha`. A page showing only successful checks is *not* evidence of all required checks, final acceptance, hardware acceptance, or released-product readiness. Every 30-entry page is conservatively marked potentially partial; inconsistent or foreign-SHA rows are excluded and make evidence partial.
- GitHub's `GET /commits/{sha}/status` covers **legacy status contexts**, separate from Actions checks. GitHub can return aggregate `pending` with **zero legacy contexts**. R30 treats that as `NO_LEGACY_STATUS_CONTEXTS`, not as a CI failure or a green build.
- A verified pair of local **Agentora R0.3** files is a **digest and lineage consistency check only**. The request is unsigned; a matching SHA-256 digest does not authenticate Agentora as the producer. The receipt explicitly says `HELD_FOR_OPERATOR_REVIEW`, `independent_checks_run: 0`, `verified_complete: false`, `head_revalidated_by_agentora: false`, and `merge_authorized: false`. Actual Agentora worker/runner execution receipts are **not** authenticated or linked automatically in R30.
- All results are transient, on-demand, public-only, and scoped to a single selected commit. Changing the commit or repository remounts the evidence bay and discards its previous read results and local file references. No network uploads or browser storage.
- The public page has no GitHub write token, no authorization to dispatch agents, execute tests, create branches, merge PRs, approve reviews, restore files, change CI, or deploy anything.

### Implementation

- `src/commit-evidence.mjs`: public-ID and SHA-bound GitHub reads, three independently failing evidence sources, per-source summaries, and explicit non-executable review handoff.
- `src/commit-evidence.jsx`: React UI loaded inside R29 Chronicle, with four labeled evidence panels and optional R27 local intake reuse.
- `src/commit-evidence.css`: responsive cards and accessible buttons/labels.
- `src/chronicle.jsx`: per-selected-commit integration; no modifications to R29 core graph or history readers.
- `tests/commit-evidence.test.mjs`: public-identity guard, mismatched SHA and first parent refusal, bounded/partial endpoints, false-green prevention, missing endpoint isolation, safe job links and handoff.
- No additional runtime package dependencies.

### Acceptance

Automated: `npm test`, `npm run build`, repository CI and isolated Chromium preview. Manual after Pages publication: choose a real historical commit with a known PR and exact-SHA Actions checks; confirm the PR links and check results; test a commit with no legacy contexts; switch commits and confirm evidence resets; test GitHub API rate limiting; optionally import genuine R8/R0.3 files and verify `0 independent checks run` and exact SHA binding; test mobile viewport, keyboard and local file clear.

### Follow-on

A governed Agentora **execution receipt** lane needs an explicitly documented, signed or otherwise independently authenticated producer contract; immutable run ID, agent identity when available, exact commit/input/output SHA mapping, safely bounded artifacts and human review. That is a separate rung. Neither a GitHub check-run success nor an unsigned local R0.3 acknowledgement can provide that authentication.

**R30 tells the truth about the evidence that actually exists, including when the answer is unknown.**
