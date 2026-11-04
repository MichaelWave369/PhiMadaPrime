# R23 · R20 JSON + ZIP importer real-browser regression (mocked GitHub)

## Why

R22 fixed a genuine UX trap: a person imported a `r20-council-review-*.json` file into the Agentora R0.7 uploader and correctly saw `EVIDENCE_REVIEW_UNTRUSTED_OR_UNSUPPORTED`. The new shortcut is useful, but a unit test of the shortcut alone doesn't verify that the R20 file upload, independent browser digest, metadata comparison, errors, historical state and Clear/reload are correctly wired together.

R23 extends the existing **R21 isolated Chromium production preview** with a second real browser test: `scripts/r23_preview_r20_import_browser.mjs`.

## Two different verification surfaces

- **R19 live**: a manual operator-approved GitHub Actions run visiting the real public Pages website at a chosen exact main SHA, producing an original artifact. A successful R19 run exists: [#41757700207](https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/41757700207), using source `99650c65dc623026088e8501841d9d0b42540f60`.
- **R20 real artifact review**: a separate Python ZIP interior validator + browser GitHub API / ZIP SHA-256 corroborator, working from that original R19 artifact. Current HEAD can move and turn previous results into **historical** evidence without denying that the previous run happened.
- **R23 preview**: Chromium exercises the actual compiled **R20 user interface**, but **all GitHub metadata is test data**, not remotely retrieved evidence. A synthetic GitHub API catalog is returned to activate the R20 parser, and fixed synthetic run / artifact / repository / branch responses are intercepted and fulfilled **in browser memory only**. The generated ZIP has legitimate ZIP headers and a JSON member, but explicitly says `R23_MOCK_ONLY_NOT_A_REAL_R19_ACTIONS_RUN`. It is **not a validated R19 artifact**, and no real GitHub action run is claimed.

## Test coverage

All ten browser checks use an ephemeral `127.0.0.1:4173` Vite production preview and a checked-out CI build revision marker:

1. Preview build marker matches the CI checkout
2. A simulated public GitHub catalog containing real-shaped but mock PhiMada identity allows the actual R20 public-catalog gate to load
3. Importing the R20 JSON into the original Agentora R0.7 uploader shows the exact expected refusal
4. The R22 shortcut opens the real R20 fields and both labels are present
5. Importing a simulated R20 reviewer JSON and ZIP triggers the real UI, browser Web Crypto digest and mocked GitHub GET responses; current-source presentation is checked
6. Corrupting a byte in the mock ZIP causes a visible fail-closed refusal
7. Forging `merge_authorized:true` in the review JSON causes a visible fail-closed refusal
8. Changing the *simulated* GitHub HEAD after the previous success yields the explicitly historical presentation
9. Clear discards the report, and a full reload discards it again
10. Non-GET/HEAD network attempts are rejected; every off-origin request is blocked or replaced with a fixed mock response

The test exercises the real browser interactions, not merely the source code. No GitHub credential or live API call is used in the browser, no storage is written by the reviewer, and no input is sent to real remote services. R21's existing Council receipt test remains separate and green.

## What success does and does not mean

**Success proves** that a compiled candidate can exercise the R20 file importer and change between present / refused / historical / cleared states using deterministic mock metadata.

**Success does not prove** the review file from run #41757700207 was independently corroborated during this test. That requires real, public GitHub REST responses and the original Actions ZIP after the separately executed R20 Python review. It does not independently authenticate the deployed SHA, the original Council producer's scientific claims, a live model Council, product completion or dispatch and merge authority.

## Operator use of actual R19 evidence

After deployment, open [PhiMada Prime](https://michaelwave369.github.io/PhiMadaPrime/), navigate to **Mission Board → Agentora / Pilot Evidence Bay**, and use **Go to R20 Council JSON + R19 ZIP import**.

Import `r20-council-review-41757700207.json` and the original `phimada-r19-council-41757700207.zip` into the R20 fields. The browser contacts actual public GitHub for immutable run and artifact metadata and two HEAD observations. Because merges after #21 changed main, that recorded R19 run is expected to be classified **HISTORICAL** if main remains at a later SHA. That is a correct, informative result, not a failed browser test. The operator may run R19 again at a newer current deployed SHA to obtain newer live acceptance evidence, but R23 never does so or schedules it.

## PR verification

```sh
npm test
node --check scripts/r23_preview_r20_import_browser.mjs
npm run build
```

The **R21 Isolated Chromium Council Preview** workflow now runs both the original R21 browser suite and R23's separate 10-check mock API/browser exercise. Each emits a separate bounded JSON artifact; neither run can dispatch jobs, merge code or authorize a scientific conclusion.

**A green artifact is a record of exactly its scope, not a permission slip to change it.**
