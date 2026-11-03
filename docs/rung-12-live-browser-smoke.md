# ΦMada Prime Rung 12: live Chromium browser smoke

R12 provides a **real, read-only browser acceptance pilot** for the published PhiMada office. It is the next acceptance surface after the source-bound R0.6 Node test/build pilot and the R10/R11 Evidence Bay.

R12 is not automatically run by a PR, push, Pages publication, or an office button. Its GitHub Actions workflow is a separate **manual-only** entrypoint to avoid network traffic and browser-test failures being mistaken for approval of production changes. It cannot merge or mark software complete.

## What R12 adds

- A validated, non-secret **build-source SHA marker** in the deployed office footer. The Vite build injects \`GITHUB_SHA\` only when it is an exact lowercase 40-character SHA. Local builds with no \`GITHUB_SHA\` advertise \`UNSTAMPED / LOCAL\`. The build SHA is not a cryptographic deployment attestation.
- A pinned Playwright Chromium runner that visits only \`https://michaelwave369.github.io/PhiMadaPrime/\`. It never follows a third-party login, writes to GitHub, dispatches an Agentora job or imports user files.
- The CLI independently reads the expected public PhiMada repository identity and \`main\` HEAD twice before and twice after the UI exercise. A changed branch HEAD, incorrect numeric repo ID, renamed/private/archived repo, or incorrect requested SHA is held.
- The browser requires the **deployed build marker** to equal the exact requested SHA. If Pages is still serving an earlier release after a merge, R12 fails closed instead of attributing an old site to the new source.
- Bounded browser journey: public page boots, actual public catalog loads, search finds PhiMada Prime, desk opens as a dialog, Escape closes it, Mission Board opens, Evidence Bay exposes its two file controls without claiming any loaded evidence, and Return to Office works.
- A local JSON receipt with status for each check, observed build SHA, pre/post GitHub HEAD, workflow run ID, and any bounded browser JS error. Uploaded only to the same GitHub Actions run as a short-retention artifact. A failure can yield a failed receipt, not a green badge.

## Run after merging R12 and publishing Pages

1. Review and merge the R12 PR **only after its normal unit/build/public-fleet CI passes**.
2. In PhiMada Prime, open **Actions → Publish PhiMada Prime** and confirm the most recent \`main\` Pages deployment succeeded. GitHub Pages may lag a merge; this runner will refuse a stale build marker.
3. Open **Actions → PhiMada R12 Live Browser Smoke (Manual) → Run workflow** on \`main\`.
4. Enter \`source_sha\`: the **current 40-character \`main\` HEAD** for PhiMada Prime.
5. Enter \`confirmation\`: \`RUN_PHI_MADA_BROWSER_SMOKE\`.
6. Run. A GitHub-hosted ephemeral runner installs Chromium and exercises the real public Pages website. It reads the public GitHub API using a \`contents:read\` token **only on the runner**, not in the browser context.
7. Inspect the run and download \`phimada-r12-browser-<run_id>\` from Artifacts if needed. The JSON distinguishes \`AUTOMATED_BROWSER_SMOKE_PASSED_AT_OBSERVED_SHA\` from source drift, unstamped/stale Pages, missing interactions, and browser runtime errors.

## What a passed receipt proves

The public site served HTTP 200, loaded the app and public repo catalog, enabled the fixed read-only desk/Mission Board/Evidence Bay UI journey in real Chromium, advertised the same source SHA that was independently observed from GitHub \`main\` before and after, and recorded no uncaught browser JS exceptions.

It **does not** prove complete browser coverage, accessibility compliance, keyboard focus semantics beyond Escape, deployed artifact cryptographic provenance, release readiness, offline support, or product completion. It also does not certify GitHub Pages serves a signed or otherwise independently authenticated build, because a page-produced SHA marker is not a signature.

R12 does not add automatically accepted checkboxes to completion contracts. A future rung can import and independently review the R12 artifact before crediting scoped \`browser_interaction\`; \`accessibility\` and \`deployed_revision\` still need dedicated acceptance evidence.

## Safety, freshness and provenance

- No PR/push/scheduled automatic execution. User must supply \`RUN_PHI_MADA_BROWSER_SMOKE\` and an exact commit SHA for every run.
- Fixed public site URL and fixed repository API endpoints. No arbitrary URL or command inputs.
- GitHub token is used for host-side read-only repository identity/HEAD requests only and never passed to the Chromium page.
- No cookies, user accounts, form submissions, user files or workspace credentials. The UI interactions select only read-only views.
- Successful smoke observations are historic at the given SHA; they do not freeze future branch HEAD.
- Workflow artifact JSON includes only bounded metadata and no screenshots, tokens or personal files.
- When GitHub API, the live catalog, Chromium, or the published Pages site is unavailable, the runner fails closed.

## CI and tests

    npm test
    npm run build

R12 adds \`tests/browser-smoke.test.mjs\` (14 deterministic tests for contract, drift, authority and workflow invariants). Normal PR CI **does not launch live Chromium**; only the manual R12 Actions workflow actually touches the deployed website.

## Next step

After the first successful R12 manual run, connect its run-bound artifact to the Evidence Bay as a separate browser-interaction receipt. Keep R10/R11's existing build/test evidence separate, preserve the exact source SHA, and leave human/accessibility/deployment acceptance gates open.
