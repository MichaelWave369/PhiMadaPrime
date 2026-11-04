# R28: Agent Forge · Pierre-powered public PR review

## Scope

Agent Forge adds a read-only code-review bay to the existing ΦMada Prime **Mission Board**. It integrates the official `@pierre/trees` React changed-file navigator and `@pierre/diffs` React `PatchDiff`. The new surface does not replace the virtual office, One Repo Finish Lane, Agentora, or their existing evidence and trust contracts.

## How to use

1. Open **Mission Board** in the PhiMada Prime React application.
2. Expand **Agent Forge · Code Review Bay**.
3. Filter the complete discovered *public* `MichaelWave369` repository catalog and select one verified catalog entry.
4. Choose **Load open PRs**. This explicitly fetches at most 10 public PRs; a full list is not implied at the upper limit.
5. Choose **Review changes** on one observed PR. The app checks the selected PR's target repository identity and exact head/base SHA, then reads at most 50 changed files from GitHub's public API.
6. Browse the changed-file tree powered by Pierre Trees, or use the accessible file selector. Choose a file to view a syntax-highlighted unified patch via Pierre Diffs.
7. **Mark locally reviewed** if useful. The mark exists in browser React state only, resets when the selection changes, and never becomes GitHub approval.
8. **Copy review-only handoff** to get the PR URL, observed SHAs, path, observation time, and explicit no-authorization notice.

## Limits and safety

- The project is a **static GitHub Pages read-only application**. It has no private token, secret, git server, agent executor, authenticated review writer, merge control, CI runner or deployment grant.
- Only catalog entries with valid owner, numeric id and non-example identity may be queried; cross-repository PRs and invalid target identifiers are rejected.
- Public API calls are on demand; browser credentials are omitted. Read endpoints are fixed to the selected owner repository. Public GitHub rate limits and CORS remain external dependencies.
- This first rung uses a **changed-files tree**, not the full repository contents. A later rung can add an independently checked, bounded full tree and commit-specific raw-file preview.
- GitHub may omit patches for binary files or very large diffs. Those files display a limitation rather than generated substitute code. Patches are locally capped at 120,000 characters. Paths with unusual or unsafe characters are skipped and counted.
- Exactly 10 PRs or exactly 50 changed files is **potentially partial**, never silently called exhaustive. Changed-file details have no diff against a subsequently moved head until the operator explicitly reloads.
- Any status or local mark is **not** functional verification, independent review, required-check completeness, merge eligibility, or permission to dispatch.
- Dependency versions are pinned (`@pierre/diffs`, `@pierre/trees`). Trees is still beta; review its public API before upgrading. Its UI is a navigational viewer, with no rename or drag-and-drop mutation enabled.
- No source control storage backend is being replaced. Pando and Pierre Code Storage are not assumed publicly available as external write APIs.

## Verification

`npm test` includes `tests/agent-forge.test.mjs` for public identity checks, exact SHA linkage, fail-closed API errors, path exclusion, bounded diffs and partial response labels. `npm run build` must pass in CI. Also manually test PR selection, keyboard tree navigation, missing patches, small-screen layout and public API rate-limit messages in the deployed browser.

**Future rung:** full commit-specific repository tree, bounded file view, optional local scratch diff and then an independent authenticated Agentora worker adapter with human approval. Those are explicitly not included in R28.
