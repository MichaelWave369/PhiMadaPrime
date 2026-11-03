# R20 · GitHub-correlated Council browser evidence in the PhiMada Evidence Bay

**Review-only; no automatic R19 launch, no source attestation, no scientific claims, no job dispatch or merge.**

## Relationship to R19

R19 is a **separately manual** live Chromium workflow that exercises the actual deployed PhiMada Council panel at an exact operator-provided current `main` SHA. Merging R19 did not run the browser acceptance check. R20 is a way to bring **a real resulting R19 GitHub Actions ZIP** into the existing Mission Board → Agentora / Pilot Evidence Bay, only after the operator actually runs R19.

R20 cannot itself launch R19, infer that an unrun browser test passed, or certify deployed code from a PR build.

## Manual workflow

1. Verify that PhiMada GitHub Pages deployment is successful for current `main`.
2. Open [R19 Live Council Browser Acceptance](https://github.com/MichaelWave369/PhiMadaPrime/actions/workflows/r19-council-browser.yml). Select `main`, enter its full current 40-character commit SHA, and type **`RUN_PHI_MADA_COUNCIL_BROWSER`**. The workflow requires explicit operator input.
3. Wait for GitHub to complete the manually invoked workflow. Only use an actual successful run with its original ZIP artifact named `phimada-r19-council-<run-id>`. Failed runs and mismatched/expired artifacts are not accepted as passing observations.
4. Download the original unmodified ZIP and run from a trusted local checkout:

   ```sh
   python scripts/r20_review_council_browser.py \
     --run-id <actual-r19-run-id> \
     --artifact-zip path/to/original-r19.zip \
     --output local-fleet/reviews/r20-council.json
   ```

   The Python standard-library reviewer reads the ZIP's single allowed `council-browser.json` member with strict size, compression, path, type and duplicate-key checks; verifies exactly nine R19 check outcomes, the fixed synthetic Keyhole receipt and zero-authority claims; verifies GitHub's **actual** workflow event/path/first-attempt success, immutable source SHA, artifact ID, name, size, and SHA-256; and samples public `main` HEAD twice. It creates the review file only after validation, with exclusive-create semantics.

5. Open [PhiMada Prime](https://michaelwave369.github.io/PhiMadaPrime/), enter **Mission Board → Agentora / Pilot Evidence Bay → R20 / Council Live Browser Evidence**. Import the R20 local review JSON and the **same original R19 ZIP**, then click Corroborate.
6. The browser independently checks the ZIP SHA-256 with Web Crypto and confirms the live GitHub run, artifact digest, repository identity and two current HEAD observations. It does **not** parse the ZIP interior or replay Chromium; that was the separately run Python reviewer and R19 Actions workflow respectively.
7. A moved source or HEAD instability is **historical/held**, not a current browser acceptance. Clear the local review to discard the files from in-tab state.

## What "correlated" means

- **R19 run success + original archive**: externally observed one read-only GitHub workflow at its declared source commit.
- **Python validation**: the original ZIP's contents are structurally and semantically checked. This is a locally executed source reviewer, not a remotely signed attestation.
- **Browser corroboration**: match original ZIP hash to the GitHub artifact digest and the metadata of the exact manual workflow. Two HEAD observations classify source current vs historical; they cannot cryptographically prove the Pages build came from that SHA.
- **Nine reported R19 checks**: bounded automated browser test outcomes as reported by the trusted archived receipt. Not an independent replay by R20, not total WCAG or user acceptance.
- **NBG science**: no physical measurement or new physics established. E1 fixture is explicitly `PUBLIC_SYNTHETIC` and source `DECLARED_UNVERIFIED`. ThinkTank, PocketBrain and Vessie are not called by this feature.

## Failure controls

The Python reviewer refuses malformed or extra ZIP entries; duplicate JSON keys; wrong workflow paths/events; red or rerun workflow conclusions; forged source, role, model, scientific or merge flags; incomplete checks; wrong repo ID; invalid SHA/time; stale reports; and wrong GitHub artifact SHA/size. A successful historical run remains historical, not a source-current result.

The browser refuses fabricated reviewer fields and authority claims, bad local archive digests, wrong artifact metadata, mismatched GitHub run/source, repo identity drift, bad publication age and changing HEAD. Inputs remain in current tab memory and are neither uploaded nor persisted. External API reads are fixed, credential-free GitHub **GET** requests. No arbitrary URLs from imported JSON are fetched.

## Verification

```sh
npm test
python3 -m unittest discover -s tests -p 'test_r20_council_review.py' -v
npm run build
```

The PR CI and Pages publication workflows include these tests. They use **synthetic locally mocked GitHub API data**, not an actual R19 run, and must not be reported as real deployment acceptance. The real manual R19 workflow remains the next separately performed operator action.

**No green fleet-completion light, job dispatch or merge authority is derived from this review.**
