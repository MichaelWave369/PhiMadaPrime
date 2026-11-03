# ΦMada Prime Rung 14: live axe-core and keyboard accessibility audit

R14 is the next *independent, manually launched observation* after R12's live Chromium smoke and R13's browser-artifact evidence review. It checks three public UI states in a real browser:

1. The 12-desk office, with the public catalog loaded.
2. The PhiMadaPrime repository inspector dialog.
3. The Mission Board with its Evidence Bay expanded.

The **actual R14 run does not start on push, PR creation, Pages deployment or merge**. The default CI suite only checks that the audit contract, static workflow and failure semantics behave correctly. A separate maintainer must authorize every live audit.

## Manual GitHub Actions workflow

After merging PR #14 and verifying the Pages deployment on the *same* current main commit:

1. Open **Actions → PhiMada R14 Live Accessibility Audit (Manual)**.
2. Select the **main** branch.
3. Paste the **current exact 40-character PhiMada Prime main HEAD** into \`source_sha\`.
4. Enter the typed confirmation \`RUN_PHI_MADA_A11Y_AUDIT\`.
5. Start the workflow. It launches headless Chromium, checks public GitHub repository identity and HEAD before and after, and insists the deployed build marker matches the requested SHA.
6. Download \`phimada-r14-accessibility-<run_id>\` from the run's **Artifacts** area, **even if the audit is red**. Its \`accessibility.json\` is the bounded review receipt.

The R14 runner uses \`@axe-core/playwright\` pinned to \`4.14.0\` and \`playwright\` pinned to \`1.56.1\`. Axe scans use WCAG 2.0/2.1/2.2 A and AA rule tags, running in the default office, the open inspector and the expanded Mission Board. They capture rule IDs, impact, short help text, and affected-node counts **without capturing page HTML, user data, selectors, screenshots or clipboard content**.

The smoke also attempts four specific keyboard interactions: pressing Enter on the focused repo desk to open the inspector, Escape to close it, Enter to open the Mission Board, and Enter to expand the Evidence Bay disclosure.

## Result handling

- \`AUTOMATED_ACCESSIBILITY_CHECKS_CLEAR_AT_OBSERVED_SHA\`: all three views scanned without detected or incomplete axe rules, four keyboard checks passed, page JavaScript had no uncaught errors, and both GitHub HEAD observations and the deployed build marker matched the requested SHA.
- \`AUTOMATED_ACCESSIBILITY_FINDINGS_REQUIRE_REVIEW\`: at least one reported axe violation **or incomplete rule** exists. This is useful, actionable evidence, not a reason to hide a defect.
- \`KEYBOARD_CHECKS_REQUIRE_REVIEW\`: one or more scoped keyboard interactions failed.
- \`HELD_INCOMPLETE_ACCESSIBILITY_SCANS\`, \`HELD_SOURCE_SHA_CHANGED_OR_UNKNOWN\`, or \`HELD_DEPLOYED_SHA_MARKER_MISMATCH\`: source/page/scan completeness could not be established.

The workflow returns nonzero on findings, missing scans, source drift, keyboard failures or browser runtime exceptions. Its artifact upload step uses \`if: always()\` so findings survive a red run. No automatic edits are made in response.

## Trust and acceptance boundaries

**Automated axe scans catch a subset of accessibility problems.** They do not by themselves establish WCAG conformance, assistive-technology compatibility, mobile/screen-reader usability, comprehensive keyboard coverage, content comprehension, or successful human accessibility acceptance. The resulting JSON explicitly sets \`full_wcag_conformance_verified=false\`, \`assistive_technology_reviewed=false\`, \`accessibility_contract_accepted=false\`, \`verified_complete=false\`, \`product_verified=false\` and \`merge_authorized=false\`.

This is a report of observed public-site state for a specific SHA, not a signed deployment attestation. It does not edit local completion contracts or publish results to the public Pages site. The artifact is retained for seven days. Future changes invalidate its current-head applicability, just as for R12.

## Safety

The workflow is \`workflow_dispatch\`-only, fixed to the public PhiMada site and public GitHub metadata API reads; GitHub permissions are \`contents: read\`. No secrets are passed into Chromium, no forms containing user data are submitted, no GitHub writes, no automatic PR merges, and no release or completion approval.

A future R15 can use failing R14 observations to identify and fix concrete problems, then repeat the read-only audit and add an independent, provenance-checked accessibility evidence lane. Any "accessible" badge must stay narrower than full WCAG acceptance.

## Validation

    npm test
    npm run build

Fourteen \`tests/r14-accessibility.test.mjs\` cases cover manual confirmation, source drift, missing/stale deployment marker, all three states, keyboard failures, axe findings and incompletes, bounded receipt fields and false authority flags.
