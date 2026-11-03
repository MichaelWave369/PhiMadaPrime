# ΦMada Prime Rung 13: browser evidence review and Evidence Bay intake

R12's real, manually triggered Chromium test passed in run
[41710656371](https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/41710656371),
at source SHA \`f4628472a09826166dcad84b403830b4f8a992a5\`. R13 links
that browser receipt to GitHub's actual artifact, runs a strict read-only
provenance review, and displays it in the office next to R0.6 Node/build evidence.
**R13 does not rerun the browser or grant software-completion/merge rights.**

## First: download the actual R12 ZIP

Open the successful R12 Actions run. Under **Artifacts**, download
\`phimada-r12-browser-41710656371\`. GitHub should supply a ZIP. Save
the ZIP in a local, untracked directory such as \`local-fleet/\`.

The R12 ZIP contains a small \`browser-smoke.json\` receipt. GitHub's public
artifact metadata reports the ZIP SHA-256; a copied JSON file alone cannot
pass R13, because it lacks its source artifact and metadata linkage.

If another commit is merged after the first R12 run, the historical receipt
remains valid for its original SHA, but **does not prove the new revision works**.
Use a fresh manual R12 run for the new SHA.

## Second: run R13 local reviewer (Python standard library only)

From the checked-out \`PhiMadaPrime\` repository:

    python scripts/r13_review_browser_evidence.py \
      --run-id 41710656371 \
      --artifact-zip local-fleet/r12-browser.zip \
      --output local-fleet/reviews/browser-r13.json

If needed, provide a read-only \`GITHUB_TOKEN\` environment variable. The reviewer
performs only fixed GitHub API GET requests; it doesn't call mutation endpoints,
run untrusted source, dispatch builds or merge PRs.

R13 validates the **real GitHub run**, its repository numeric ID,
manual workflow path, successful first attempt, timestamp freshness, unique
artifact ID and digest, SHA-256 of the original ZIP, and the ZIP's internal
JSON. Each of R12's eight browser checks must be \`PASS\`, with no reported
page errors, exact pre/post source SHA and deployed build marker agreement.
All authority, accessibility, full-journey and product-completion flags
must remain false.

The reviewer then independently fetches current GitHub repository identity
and \`main\` HEAD **twice**. A moved HEAD generates a historical review, not
current-branch acceptance. A changed HEAD between reads fails closed.

CLI exit codes:
- \`0\` means archive and GitHub observations corroborated and source was
  current at review time.
- \`2\` means corroborated **historical** source; receipt written with no
  current-branch credit.
- \`1\` means held/invalid evidence; no passing receipt is written.

R13 output is a local, exclusive-create \`browser-r13.json\`, private mode
0600 on POSIX. It is **unsigned**, not an independent rerun.

## Third: inspect it in the office

1. Open the [PhiMada Prime Mission Board](https://michaelwave369.github.io/PhiMadaPrime/).
2. Expand **Agentora / Pilot Evidence Bay → R13 / Live Browser Evidence**.
3. Import your **browser-r13.json** and the **original R12 ZIP**.
4. Select **Corroborate browser run + ZIP**.

The browser independently hashes the ZIP with Web Crypto and reads GitHub's
public run, artifact digest, repo identity and two current HEAD observations.
It shows **8/8 browser checks reported** from the reviewer only when the review
and external metadata correlate. It never claims the browser independently
replayed tests or parsed ZIP internals. The Python script is responsible for
validating the ZIP's interior.

If the current source changed, the result is clearly **historical**; a
new R12 manual run must be executed for the new commit before treating
browser smoke as current.

## Completeness boundaries

- R0.6 covers reported \`production_build\` and \`automated_tests\` checks.
- R12/R13 adds a bounded reported \`browser_interaction\` smoke for the
  source revision observed during R12.
- Dedicated \`accessibility\` and independently confirmed
  \`deployed_revision\` acceptance **remain open**. Build SHA markers are
  source assertions within the page, not cryptographic deployment attestations.
- The browser Evidence Bay reports results but does **not** mark local
  completion contracts as accepted. All independently accepted counts remain
  zero until a governed trust and operator review procedure exists.
- Neither browser nor CLI signs receipts, approves releases, dispatches jobs,
  writes to GitHub, or certifies a product complete. The original R13 reviewer
  cannot certify a future HEAD after another push.

## Validation

    npm test
    npm run build
    python -m unittest discover -s tests -p test_r13_browser_review.py -v

CI and Pages both run the 15 Python tests, and Node's normal suite picks up
the 14 new browser-integration unit tests. No live R12 browser workflow is
launched automatically by merging this PR.
