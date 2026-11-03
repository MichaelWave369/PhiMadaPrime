# PhiMada Prime R19: manual deployed Research Council browser acceptance

**Scope: real public GitHub Pages browser interactions, public-synthetic fixed input, exact current source SHA, read-only operator action.** No claims of authentic Council participants, physics evidence, full product verification or merge authority.

## Why

R18 merged a read-only Council E1 JSON panel under **Mission Board → Agentora / Pilot Evidence Bay**. Node tests and a Vite build established local parser/UI compilation, but not whether the **deployed** panel can be opened and used. The older R12 smoke also counted *all nested file inputs* and would now fail on the additional R18 upload. R19 scopes R12's original two-file check to `.evidence-bay-upload` and adds a separate manual browser journey specifically for Research Council.

## Before running, after R19 merges

1. Confirm PhiMada's **GitHub Pages** deployment is successful. The source SHA marker is an ordinary build assertion, **not** signed deployment attestation.
2. Open [R19 Live Council Browser Acceptance](https://github.com/MichaelWave369/PhiMadaPrime/actions/workflows/r19-council-browser.yml), choose **Run workflow**, and select the current `main` branch.
3. Paste the **full 40-character current `main` commit SHA** into `source_sha`.
4. Type exactly `RUN_PHI_MADA_COUNCIL_BROWSER` into `confirmation`.
5. Start the workflow manually. If `main` moves before/during/after the run, or Pages has an older build marker, the result is **held/red** rather than promoting historical evidence into current acceptance.
6. Open the Actions run. It stores `r19-artifacts/council-browser.json` as a seven-day artifact named `phimada-r19-council-<run-id>`, including failed/incomplete checks when the CLI can produce a receipt. Do not treat a missing artifact as success.

The workflow has **`workflow_dispatch` only**, no push/PR/schedule trigger, no write or deployment permissions, no runtime agent API, and no browser credential or user account. The site uses ordinary public GETs for its catalog; the fixture is inserted through Playwright's local file chooser, not uploaded.

## Nine required browser checks

| Check | Observed expectation |
| --- | --- |
| `page_deployed_sha` | Public Pages HTTP 200; exact current SHA equals displayed build marker; public catalog ready |
| `mission_board_and_council_open` | Actual Mission Board, existing Agentora Evidence Bay and nested Council disclosure open |
| `golden_receipt_display` | Manually selected fixed PocketMesh E1-D public synthetic JSON presents all three seats and HELD status |
| `tampered_receipt_refused` | Alter a receipt's declared SHA without recomputing hash; the UI refuses it |
| `rehashed_authority_refused` | Set `executionAuthorized:true` and recompute envelope digest; still refused |
| `self_consistent_forgery_untrusted` | Fabricate different declared source SHAs and recompute all hashes; accepted **only as unauthenticated HELD** |
| `clear_restores_empty` | Clear leaves no prior review result |
| `reload_discards_review` | Reimport then reload; no review state survives |
| `no_write_requests_observed` | During this browser journey, no non-GET/HEAD request is seen |

Passing all checks demonstrates a bounded deployed-browser UI journey on the observed source revision. It **does not** prove no GET exposed state outside this workflow, that every accessibility rule passed, or that the endpoint is independently source-authenticated. In particular, `no_write_requests_observed` is an observation of this browser session's request methods, not a universal application-level guarantee.

The original R12, R13 and R14 audit workflows remain independent. A passing R19 must **never** override pending R14 manual axe accessibility findings, independent user/assistive technology review, Agentora completion contracts, or PhiKernel approval rules.

## How to interpret the receipt

A clean, checked source and deployed marker plus all nine `PASS` outcomes yields:

`COUNCIL_BROWSER_INTERACTIONS_PASSED_AT_OBSERVED_SHA`

Any missing, failed, or incomplete check or browser runtime error blocks that result. A changed HEAD, unknown HEAD or mismatched deployed marker is held. Every report retains explicit false values for scientific evidence, source independence, deployed cryptographic attestation, model execution, council approval, accessibility conformance, product completion, dispatch and merge permission.

The operator-supplied fixture is `tests/fixtures/council-e1-producer-golden.json`, copied from NBGPocketMesh E1-D. The receipt records its local SHA-256. The workflow **does not** authenticate the fixture by independently refetching it from the producer or verify an active council. Self-consistent source forgery remains held and untrusted.

## Local validation before PR merge

```sh
npm test
npm run build
node --check scripts/r19_council_browser_contract.mjs
node --check scripts/r19_live_council_browser.mjs
```

The ordinary PR test pipeline validates the source contract and live-test runner wiring only. **Do not invoke the live workflow from PR CI**, because it requires explicit operator confirmation and a deployed exact-`main` SHA.

**Fleet above vanity. Evidence above animation.**
