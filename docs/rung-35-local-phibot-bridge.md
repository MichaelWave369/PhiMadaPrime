# R35 · Local PhiBot Queue Bridge (manual file import)

R35 is a **working, operator-mediated, offline transfer** between PhiBot's
existing PHIBOT-25 persisted queue and PhiMadaPrime's R34 Crew Deck.

## Manual use

1. Merge/test PhiBot R35A and PhiMadaPrime R34/R35 in their intended order.
2. On the local PhiBot machine, specify PHIBOT_REPO_ALLOWLIST with only
   repository names that you are prepared to disclose.
3. Run npm run crew:export -- --ack-repository-disclosure from PhiBot.
4. Open PhiMadaPrime > Mission Board > R34 PhiBot Crew Deck.
5. Under R35 Local PhiBot Queue Bridge, choose the generated JSON from
   PhiBot's ignored .phibot/work-queue/crew-exports/ folder.
6. Inspect the recorded jobs, timestamps and outcomes. Clear when finished.

There is no upload endpoint, browser-to-localhost call, model API or automatic
sync. The imported data stay in React session memory. The file contains local
queue repository names and should never be checked into git or published.

## Acceptance policy

The browser importer validates the exact v1 schema, strict source and
no-authority classification, generatedAt recency (24h, max 5m future),
bounded size (100 KB), at most 100 jobs, exact counts, unique IDs,
known read-only capability names, bounded attempts, safe timestamps,
outcomes and no extra/secret fields. **Every job** must match the
already-discovered real public MichaelWave369 catalog (not examples).
On mismatches, the entire file is rejected, not partially trusted.

The UI makes clear that:
- completed records are LOCAL read observations, not completed software work;
- leased state does not establish a live process or heartbeat;
- zero verified runtime workers does not imply PhiBot is not running;
- a local self-report is not a cryptographic attestation;
- reading JSON never gives an agent tools, grants or execution authority.

## Verification

Run npm test, npm run build and the existing isolated browser CI.
After deployment, manually import a *real* locally generated file and test
the negative paths (private repo name, malformed JSON, duplicate job ID,
expired snapshot, oversized JSON, file picker keyboard controls).
Existing generic Chromium UI smoke checks do not prove R35 manual field
acceptance.

## Future
R35B: optional authenticated operator-only local live viewer with a separate
security review. Public Pages must remain free of tokens and private backend
access. R36: human-approved, exact-digest task handoff via Reality Gate.

## Mainline recovery / R35 compatibility

PR #37 originally merged into the historical R34 feature branch after
R34 had already reached main. This mainline patch installs the importer
on current main instead of assuming a branch merge was a production release.

GitHub repository names are case-insensitive. On import, an allowlisted
name such as MichaelWave369/PhiBot is matched case-insensitively to the
actual discovered public catalog entry MichaelWave369/phibot. The UI
displays **only the canonical verified catalog name**. Foreign owners,
non-catalog repositories, example catalog entries, and private/unverified
repositories continue to fail closed. No new network reads or authority.
