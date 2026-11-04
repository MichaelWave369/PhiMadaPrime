# PhiMada R24: Existing real R19 Actions artifact into live R20 UI

**Manual, read-only, SHA-bound. Does not rerun R19.**

## Why

R19 [run 41757700207](https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/41757700207) really passed a Chromium journey on the deployed Pages Council panel for source `99650c65dc623026088e8501841d9d0b42540f60`. R20 can validate the original Actions ZIP and correlate it with GitHub, and R22/R23 made the form discoverable and tested the importer with **mock GitHub APIs**. The remaining operator handoff needed an integration test against the actual **deployed R20 panel using a real original R19 ZIP and public live GitHub GETs**, without relying on repeated manual uploads.

R24 introduces a **separately manual** `workflow_dispatch` action named `R24 Actual R19 Artifact to Live R20 Handoff (Manual)`.

## How to run after merging and deploying this workflow

1. Confirm current PhiMada Pages deployment has the latest `main` SHA marker. The workflow fails closed on old deployment or moved source.
2. Open [R24 manual handoff workflow](https://github.com/MichaelWave369/PhiMadaPrime/actions/workflows/r24-live-r20-handoff.yml), select `main`.
3. Enter the **existing successful R19 run ID** (for example `41757700207`) into `r19_run_id`.
4. Enter the **complete, current 40-character `main` SHA** into `source_sha`.
5. Type **`REVIEW_EXISTING_R19_ON_LIVE_PAGES`** as the exact confirmation.
6. Launch manually. Inspect the CI job and its bounded `phimada-r24-live-handoff-<workflow-run-id>` artifact. A missing or red artifact never means success.

Run IDs must be positive decimal, and the selected workflow checkout must equal the operator-specified main SHA. R24 does not automatically select a new R19, run the R19 workflow, replay Council models, dispatch jobs, approve science, or merge PRs.

## R24 two-step evidence chain

### A. Original artifact preparation (Python)

`scripts/r24_prepare_live_r20.py` authenticates only to GitHub's **read-only Actions API** using the short-lived `github.token` scoped to `contents: read` and `actions: read`. It checks the repository identity and two current main observations, looks up **one exact successful R19 artifact name** by numeric run ID, checks its metadata and expiry, and downloads the **original ZIP bytes** by immutable artifact ID.

GitHub may redirect artifact ZIP downloads to a signed temporary blob URL. The downloader accepts **one redirect only**, requires HTTPS and an allowlisted GitHub artifact-blob host, and creates a **fresh, unauthenticated GET** to fetch the bytes. The repository token is never forwarded to that blob host. It reads at most 2MB and checks downloaded ZIP SHA-256 against the GitHub Actions artifact digest and size.

It passes the original ZIP to **the existing R20 independent Python validator**, not a weaker substitute. This validates the single ZIP JSON member, exact recorded nine R19 checks, source SHA, no-authority claims, workflow run metadata and current HEAD. This step can rightly classify run 41757700207 as **HISTORICAL** after later merges.

Only after successful validation does it write two temporary, private-runner files: `r24-private/original-r19.zip` and `r24-private/r20-review.json`. The original ZIP and locally reviewed JSON are **never uploaded as R24 artifacts**.

### B. Actual deployed-site browser acceptance (Chromium)

`scripts/r24_live_r20_handoff.mjs` runs Playwright Chromium on the real [PhiMada Pages](https://michaelwave369.github.io/PhiMadaPrime/) deployment. It requires the webpage's build marker to match the exact current `main` SHA and a public GitHub catalog to load. It opens Mission Board → Evidence Bay → **Go to R20 Council JSON + R19 ZIP import**, uses the real file pickers, and clicks **Corroborate R19 ZIP + GitHub source**.

The R20 front-end independently computes the selected ZIP SHA-256 with Web Crypto and calls **real, unmocked public GitHub REST** to correlate the source run, artifact metadata, repository identity and HEAD. R24 confirms those network requests were observed and that the visible R20 result reports the right source status, including a historical result for older runs. It clicks Clear, verifies the local result disappears, and rechecks GitHub main before accepting the browser session.

The Chromium context allows only GET/HEAD to PhiMada's public Pages and `api.github.com`. Other origins are blocked and all write-method attempts are refused. No secrets or GitHub token enter the browser, and no page screenshot, ZIP, JSON or private text is uploaded by R24.

Eight bounded checks create a small `r24-artifacts/live-r20-handoff.json` metadata receipt even on browser failures.

## The critical difference between historical and rejected

**Passing R24 with `R24_EXISTING_R19_ARTIFACT_LIVE_R20_CORRELATED_HISTORICAL_SHA` is a success** of the archive and UI handoff. It confirms that the **older** R19 run's original ZIP and current GitHub metadata agree and that PhiMada correctly labels it as historical. It does **not** prove today's deployed version passed R19. To establish that, a user must separately run a fresh manual R19 at the newer SHA. R24 will never do it for them.

If actual source/head changes during review, a fixed input fails, the ZIP digest differs, the public API is unavailable, or the browser result is missing, the workflow is **held/red**. Do not retroactively change the SHA input to force a green.

## Test and trust limits

The normal PR CI and Pages workflow run **12 mocked Python download/review tests** (including token not forwarded through redirects) and **12 source-only Node policy tests**. **These do not run the R24 live workflow**; that requires operator input after merge.

R24 results neither independently replay the original R19 UI test nor authenticate the Council's synthetic scientific material. The human review boundary remains intact:

- R19: real deployed Council interface test at that original source SHA.
- R20: independent original ZIP review and live GitHub metadata correlation.
- R21: compiled PR preview Chromium acceptance.
- R23: R20 form/browser journey with mock API.
- R24: actual original R19 artifact and **real** deployed R20 form + **real** GitHub API handoff.

**Nothing in this workflow executes Council models, makes scientific conclusions, marks fleet products complete, approves jobs or merges code.**
