# R32 · Run Observatory: exact-SHA GitHub Actions jobs and step inspection

## Why this rung exists

R29 Chronicle shows a bounded Git commit timeline. R30 correlates associated PRs, check runs and legacy status contexts. R31 adds an Agentora-specific, stronger controlled-workflow verifier. R32 adds an **operator-triggered public GitHub Actions workflow run/job/step inspector** for any eligible public fleet repository, allowing diagnosis of which real step failed without claiming an independent security audit.

## Operator steps

1. Open **Mission Board → Agent Flow + Chronicle**, select a verified public repository and load its branch and commit timeline.
2. Select a historical commit, then click **Inspect PR + CI evidence** in R30.
3. Expand the new **R32 Run Observatory** area, and click **Load GitHub workflow runs**.
4. The app revalidates public repository numeric ID, full name and visibility, and the selected exact commit/first-parent SHA before reading `GET /repos/{owner}/{repo}/actions/runs?head_sha=<sha>&per_page=12`.
5. Select a returned workflow run by name, path, event, attempt and observed conclusion. Choose **Inspect run jobs + steps**.
6. The app independently re-reads the selected run by numeric GitHub run ID and checks its SHA, repo identity, workflow path, status, conclusion and **attempt**. If GitHub reran the workflow or changed the record since the run list was read, it refuses and asks for a fresh inventory.
7. It then reads at most 50 jobs from that exact run, checks each job's run ID, attempt and head SHA, and displays up to 75 steps per job including GitHub's name, status, conclusion, start and end timestamps. A missing/unsupported/truncated step or job response marks coverage incomplete.
8. Inspect the exact GitHub run/job in a new tab for full details or copy the **R32 review-only handoff**. No log download or code execution occurs in the browser.

## Evidence boundaries and limitations

- The public GitHub Pages app makes only explicit GET requests with `credentials: omit`. No GitHub tokens, runner triggers, reruns, PR approvals, merges, rollbacks or deployments.
- Only live-verified canonical public repository identity and a Chronicle/R30-matched SHA can be queried.
- Return lists are bounded: 12 runs, 50 jobs and 75 steps per job. A page at the limit, mismatch, missing step array or excluded metadata is **partial**, not a complete statement about required CI. Missing/unavailable API data fail closed, not silently treated as green.
- Workflow runs and jobs are **execution metadata**, not authenticated individual AI agent identities, cryptographic producer attestations, reproducible results, device acceptance or proof all protected-branch required checks are satisfied.
- GitHub Actions step ordering is shown as recorded; the API does not provide a reliable job dependency graph. R32 does not fabricate an execution DAG or allow workflow rewiring.
- A historical run may be green while current `main` differs; always recheck current HEAD, rulesets and required checks before release.
- R31 Agentora trusted owner authorization and verified R1 return are a separate stronger lane. R32's general-purpose observation is deliberately not promoted to that level.
- URLs displayed by this feature are reconstructed from verified repository/run/job IDs, rather than trusting arbitrary URLs from API rows.
- The first page may omit historical runs, especially for busy repositories. GitHub Actions run retention and public API throttling also limit evidence.

## Code and tests

- `src/run-observatory.mjs`: exact-SHA/repository/R30 trust boundary, GitHub run and job readers, partialness and handoff.
- `src/run-observatory.jsx` and `src/run-observatory.css`: accessible responsive status/timeline UI.
- `src/commit-evidence.jsx`: mounts R32 below the R30 evidence cards, keeping R31 unchanged.
- `tests/run-observatory.test.mjs`: verified GET path/identity, source drift, partial pages, foreign run/job/step exclusion, attempts, bad conclusions, failure vs pending, no invented authority and handoff binding.
- No new package dependencies or workflow permissions.

## Acceptance

Automated: `npm test`, `npm run build`, existing CI/isolated Chromium preview. The existing Chromium preview does **not** prove this new user interaction has been manually tested.

After deployment: choose PhiMadaPrime, select merge SHA `8342eb6f226a51b11a7c17856bdd8cf1c583656f` if still visible in the bounded timeline, load R30 and R32, inspect the CI run's `verify` job and its steps. Then test a non-green historical run and a repository with no reported actions, plus keyboard focus, narrow viewport and rate-limit/unavailable states.

## Next possible rung

An authenticated Agentora worker receipt with independently verifiable per-agent execution identity would require an explicit producer identity model, replay protection, signed or appropriately trusted evidence transport, scoped verifier, exact input/output SHAs and real field qualification. R32 does not pretend public Actions job names provide those facts.
