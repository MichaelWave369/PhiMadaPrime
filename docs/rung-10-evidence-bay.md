# ΦMada Prime Rung 10: Pilot Evidence Bay

R10 links PhiMada's virtual office Mission Board with Agentora's real, opt-in Fleet R0.6 / R0.7 evidence pipeline. This is a **local, read-only operator review desk**. Nothing is uploaded to GitHub, dispatched, deployed, marked product-complete, or merged.

## Workflow

1. **Run Agentora Fleet R0.6 manually.** In Agentora's Actions tab, select **Fleet R0.6 PhiMada Sandboxed Verification Pilot** and enter the current 40-character \`PhiMadaPrime\` main HEAD plus exact confirmation \`RUN_PHI_MADA_TESTS\`. R0.6 is not triggered by merging a PR.
2. **Download the actual pilot ZIP** from that successful GitHub Actions run, named \`fleet-r06-phimada-<run_id>\`. The run records fixed Node tests and Vite build at a requested SHA, not browser or release acceptance.
3. **Review the ZIP with Agentora R0.7 CLI** after merging Agentora PR #81. Supply its numeric run ID, original ZIP and a private local review JSON output path:
   \`python scripts/fleet_r07_evidence_review.py --run-id <run_id> --artifact-zip local-fleet/pilot.zip --output local-fleet/reviews/phimada-r07.json\`
   The CLI checks GitHub run provenance, artifact digest and the ZIP's internal JSON receipts.
4. **Open ΦMada Prime → Mission Board → AGENTORA / PILOT EVIDENCE BAY.** Import the resulting R0.7 review JSON first; then import the **same original artifact ZIP**.
5. Select **Corroborate ZIP digest + GitHub run**. The browser hashes the ZIP using Web Crypto, checks its SHA-256 against the review report, and independently GETs public GitHub run, artifact, repository and two default-branch HEAD observations. The review is valid for a single PhiMada SHA, never another repo.
6. Read the resulting status. If HEAD has changed since the pilot, the office explicitly labels the receipt as **historical**, even if the previously executed tests passed. If GitHub is unavailable, artifacts expired, hashes disagree, or identities differ, the desk fails closed.

## What the office may display

- User-selected R0.7 report: **LOCAL_R07_REPORT_NOT_YET_CORROBORATED**. Structurally valid local JSON is not an authenticated review. This state cannot count as verified evidence.
- Matching ZIP + successful matching GitHub workflow + SHA-256 artifact digest, still-current HEAD: **GITHUB_ARTIFACT_AND_SOURCE_METADATA_CORRELATED**. It corroborates the specific archive bytes and GitHub metadata, **not an independent replay of tests or validation of the imported JSON's claims**.
- Matching historical artifact but a newer HEAD: **HISTORICAL_SHA_SOURCE_HAS_MOVED**. The previous pilot pertains to its original commit; no current code acceptance is implied.
- HEAD changes between the two GitHub reads: **HEAD_CHANGED_DURING_OBSERVATION**. The current HEAD status cannot be trusted without retry.
- Any missing, altered, expired, forged, overlarge or incompatible evidence: a held error with no passing status.

Every outcome keeps \`productVerified=false\`, \`mergeAuthorized=false\` and \`completionVerified=false\`.

## Trust boundaries

- **Two operator-selected files remain local** in the active browser component; no localStorage, cookies, service uploads, GitHub mutation, backend bridge or other network destination receives them. Only public, unauthenticated, read-only GitHub REST GETs are used. Browser import state disappears when the Evidence Bay unmounts.
- **The original archive's bytes must hash to the digest GitHub reports.** An attacker editing the ZIP cannot just change the JSON review to make it pass unless the public artifact digest also matches.
- **An imported R0.7 JSON report is not signed.** A malicious file might copy GitHub's public run/artifact identifiers and digest while falsifying its own story. This UI has no ZIP parser, so it does not validate the ZIP's internal preflight/steps/final JSON. Use Agentora's R0.7 CLI to inspect the original archive. The UI never calls such a file authoritative or signs an attestation.
- A public successful Actions run is not independently reproduced testing, nor evidence of a live production website, browser/UI operation, VR comfort, desktop installation, durable releases or any merge approval.
- The selected repo must exist in the actual live public catalog as numeric repository ID \`1443845098\`. Placeholder/example mode cannot elevate any evidence.
- The report is for a historical SHA; the browser re-observes current HEAD, but does not hold a transactional lock over GitHub or certify future stability.
- Browser Web Crypto and GitHub API read access are required. Rate limiting or network errors produce held status, never success.

## Test and build

    npm test
    npm run build

R10 adds \`tests/evidence-bay.test.mjs\` covering valid reports, forged authority, wrong provenance, stale timestamps, oversized or modified archives, exact GitHub workflow identity, wrong artifact digest, source movement and a mid-observation HEAD update.

## Next rung

A future trusted operator dashboard can consume fully attested receipts, map verified project-specific checks to actual completion contracts, and present missing acceptance surfaces per repo. It must keep human review and GitHub merge permissions separate. Only an explicitly authorized execution/merge system can take action.
