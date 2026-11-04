# R29: Agent Flow + Chronicle foundation

## Purpose

R29 adds a **read-only development time machine** to the existing ΦMada Prime Mission Board. It follows R28's Pierre-based Agent Forge without replacing it, and introduces a visual node graph using MIT-licensed `@xyflow/react` (pinned to 12.12.1). The graph describes **what has been observed**, not active agent execution.

## Workflow

1. Open **Mission Board → Agent Flow + Chronicle**. The feature is lazy-loaded on expansion.
2. Select a verified public `MichaelWave369` repository from the currently loaded public fleet. Curated examples cannot be queried.
3. **Load branches** explicitly. The app validates repository ID, public visibility and canonical owner/name against live GitHub REST metadata, then reads at most 20 branch entries. The default branch can be added from verified metadata even if its entry was not in that first page.
4. Choose a branch and **Load commit history**. The app re-reads the branch's current head, then requests at most 25 commits **using the immutable observed HEAD SHA** instead of the mutable branch name. Any mismatched first commit is rejected.
5. Select a commit in the scrollable timeline, then **Inspect first-parent diff**. The app fetches that exact commit and validates its first parent against the selected timeline record. It displays at most 40 changed files; missing, huge or binary patches are explicitly unavailable.
6. View text patches using existing Pierre Diffs `PatchDiff` in **split** mode. Use the GitHub links to examine the full commit/compare page.
7. Copy an exact-SHA review-only handoff if helpful. It is local clipboard text with explicit non-authorization, not a PR review or a dispatch.

The React Flow visualization has six steps: public catalog, branch inventory, commit timeline, code inspection, local review handoff and external human gate. Each node is marked `OBSERVED`, `NOT OBSERVED`, `LOCAL ONLY`, or `EXTERNAL`. The graph supports pan, zoom and node selection, not executable wiring or edits.

## Trust boundary

- Strict public owner/repository identity. No browser credentials, secrets, GitHub writes, code execution, PR approvals, rollbacks, restorations, or deployments.
- No private branch or file discovery; no bulk crawling of the whole fleet. Every GitHub request occurs only after explicit user action for one selected project.
- Branch names and commit SHAs validated before forming API requests. Potentially partial lists at exactly 20 branches, 25 commits, or 40 changed files are clearly labeled. Only the first parent is compared, not a merge commit's entire multi-parent history.
- Commit data are GitHub observations, not proof of agent causality, quality, functionality or test completion.
- No SaveStates-like independent persisted save history is created. Git commit history already tracked by GitHub is displayed; a future local snapshot/restore system requires separate versioning and authorization.
- The Graph's release node is always EXTERNAL. A copied handoff is only LOCAL ONLY. Nothing ever becomes an automatic merge authorization.
- GitHub API rate limits, missing patches, and API errors fail closed. A historical observation may become stale as HEAD moves; always revalidate before external action.
- Selected repo/branch/commit and local copy state live in React memory. Collapsing and reopening the panel resets it. No session storage or uploads.

## Engineering

- `src/chronicle.mjs`: validation, bounded GitHub API readers, immutable SHA checks, handoff construction and truthful graph status derivation.
- `src/chronicle.jsx`: React Flow canvas, repository/branch selection, visual commit timeline, Pierre side-by-side patch renderer.
- `src/chronicle.css`: responsive dark workstation styling and reduced-motion support.
- `tests/chronicle.test.mjs`: normal and adversarial readers, public-boundary checks, partial API listings, first-parent guard, false authority prevention.
- `src/mission-board.jsx` exposes the workstation through a separate opt-in expandable panel, keeping R28 Forge and the existing Mission Board unchanged.
- `@xyflow/react@12.12.1` pinned to a known published release; no auto-upgrade of agent-related dependencies.

## Acceptance

Automated: `npm test`, `npm run build`, existing GitHub CI and isolated Chromium preview. Manual after Pages publication: expand Chronicle; load a real public repository's branches; switch between default and feature branch; inspect selected commit first-parent diff; navigate graph by keyboard, verify responsive behavior and reduced motion; confirm collapse resets state; trigger API throttling/unavailable case and ensure errors are explicit.

## Next rungs, not shipped here

- A governed Agentora execution graph with authenticated, immutable evidence receipts and scoped worker events.
- Correlating exact commit SHAs to associated PR reviews, test checks, build artifacts and Agentora job receipts.
- A commit-specific *full repository* file tree and safe local before/after preview.
- Human-approved, conflict-aware restoration in a new branch, never a direct overwrite of protected `main`.

**R29 does not claim to finish software or execute agents. It creates the reviewable foundation for understanding what actually changed.**
