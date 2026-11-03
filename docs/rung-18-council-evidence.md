# R18 · Research Council Evidence Bay (synthetic, held, read-only)

## Why R18 belongs in the existing Evidence Bay

PhiMada Prime already has a mission review board, Agentora R0.6/R0.7 pilot archive review, R12/R13 live browser evidence, rolling public catalog coverage, and separate R14–R17 accessibility fixes. The Research Council should **not** create a second authority plane, change desk completion states, or make a model answer look like a GitHub-verifiable measurement.

This change adds a separately collapsed **R18 / NBG RESEARCH COUNCIL** review section inside **Mission Board → AGENTORA / PILOT EVIDENCE BAY**. It reads a manually selected **PUBLIC_SYNTHETIC** NBGPocketMesh E1 JSON file. It does not automatically fetch a receipt, contact participant apps, dispatch anything, or claim a deployed source is current.

## Input and integrity

The format is the exact `nbg-pocketmesh.council-evidence-exchange-e1.v0.1` produced by PocketMesh E1-D, not a new PhiMada-specific fork. A byte-identical copy of the [producer fixture](../tests/fixtures/council-e1-producer-golden.json) is pinned for regression testing from [NBGPocketMesh PR #13, head `ac471885cc4f5a2aae95358ae79122bddf3f8d67`](https://github.com/MichaelWave369/NBGPocketMesh/pull/13). The source was an **open PR** when this work began; it must not be represented as an automatically deployed or merged producer.

The browser checks:

- A strict 64 KiB file-size limit; manual selection, explicit Inspect click and Clear.
- Exact E1 version and fixed fields; `SIMULATED`, `PUBLIC_SYNTHETIC`, `DECLARED_UNVERIFIED`, and `authority:NONE`.
- Three ordered seats, each with exact expected role and repo identity: ThinkTank challenger, PocketBrain local observer, Vessie governance review.
- Full 40-character *declared* Git SHAs; all three receipts reference the same E0 parent digest.
- Allowed categorical actions and matching pooled/subgroup Keyhole action pairs.
- Internal SHA-256 of each receipt and the outer exchange (native browser Web Crypto and same sorted-key canonical form).
- Absolutely no extra prompt, memory, model output, private data, approval, execution, dispatch, merge or sharing claims.

A well-formed file produces a bounded categorical **HELD_UNTRUSTED_REVIEW_ONLY** preview with abbreviated source declarations, the inferred synthetic Keyhole-review suggestion, and hashes labeled as self-consistency checks. No source field is independently authenticated.

## What can be concluded

**This confirms only receipt format integrity within operator-selected JSON.** A complete forged packet can carry valid hashes; this viewer cannot attest that the PocketMesh producer executed, that a consumer ran, or that the source revisions still match HEAD. The pin is not a signature. The E0 source demonstrates a generic synthetic pooled-vs-stratified accuracy distinction, not an LHCb particle-physics result.

Do not infer that ThinkTank, PocketBrain or Vessie are active model sessions, that PhiServe ran, that GAIA/BrainC participated, or that PhiKernel grants were issued. The fixed underlying software validators previously passed a separate producer-versus-three-consumer GitHub CI run on PR #13, but R18 does **not** corroborate that run against GitHub APIs. Agentora's mission execution and PhiMada's completion contracts remain unchanged.

The review is per-tab and ephemeral. Imported data is not written into localStorage, IndexedDB, prompt history, exports, cookies, or a server. The file's contents are not echoed on errors. External links only open when a person deliberately clicks them. **No network request occurs because a file was imported**.

## Field acceptance

1. Run `npm test` and `npm run build`; review the R18 tests, including the pinned producer fixture and adversarial rehashed-forgery cases.
2. After merging and successful Pages deployment, open **Mission Board → Agentora / Pilot Evidence Bay → R18 / NBG Research Council**.
3. Download `tests/fixtures/council-e1-source-golden.json` from [the PocketMesh PR](https://github.com/MichaelWave369/NBGPocketMesh/pull/13) or use the identical pinned `tests/fixtures/council-e1-producer-golden.json` in this PR.
4. Import it and click Inspect. Expect the three distinct roles and **HELD UNTRUSTED REVIEW ONLY**, *not* a green/approved fleet desk.
5. Alter any SHA/role, import malformed/private input, and verify refusal with no private data echoed. Clear; reopen Mission Board and verify no stored review persists.
6. Confirm the existing Agentora R0.7, R13 browser, inspector dialog and mission navigation remain usable. Automated CI is not a substitute for these deployed-browser checks.

## Next gates

After PR #13 is merged, an explicitly operator-reviewed E1 producer export may become a repeatable manual handoff. A future Agentora/PhiMada rung may link a **real** GitHub Actions run ID, artifact ID, exact source SHA and reviewed archive hash. That would be a separate source-bound verification design; passing this local JSON check does not supply those facts or create an autonomous job.

**No software-completion badge. No model/physics truth inflation. Capability ≠ authority.**
