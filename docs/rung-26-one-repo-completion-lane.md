# Rung 26 · One-Repo Completion Lane

## Purpose

PhiMada already knew how to display public repositories, inspect current GitHub HEAD, prepare project-specific local completion contracts, and export a strictly non-authoritative R8 verification request. Those actions were scattered across the desk and the Mission Board, and Mission Board proposals depended on the smaller Agentora public pilot.

**R26 puts those existing controls into one visible, deliberately limited finish lane for any real public repository in the fleet.** It is not a new verifier, new Council surface, or new uploader.

## One repository at a time

In [PhiMada Prime](https://michaelwave369.github.io/PhiMadaPrime/), select **Mission Board → One Repo · Finish Lane** at the top of the board.

1. Search and select any repository in the live public inventory, even if Agentora has no pilot mission for it. A 30-option visual cap helps navigate the fleet without silently omitting it: searching all known repository names remains possible.
2. Click **Inspect / refresh HEAD**. This calls the existing desk inspector's on-demand public GitHub GETs. A source older than 15 minutes, malformed source, wrong repo, or invalid identity remains **inspection required**.
3. Click **Open project desk / contract**. Scope its *actual deliverable type* (React, WebXR, Python package, etc.), create its local checklist, and inspect the current source. This is not independent evidence.
4. Return to the lane. If the saved contract SHA differs from the observed HEAD, the lane marks **SOURCE MOVED REBIND**. Rebind at the desk and start its local review again.
5. Only if the same real R8 serializer `prepareVerificationRequest` accepts the repo, contract, exact observed HEAD and recent observation does **Download governed request** become active. Pressing it invokes the existing strict download implementation in `main.jsx`, which validates the inputs *again at click time*.
6. The exported JSON is a **request only**, not a job or test result. A human still separately approves any Agentora execution, independently reviews returned evidence, and decides releases and merges. No simulated completion status is written.

If the public catalog cannot load or the repo is one of PhiMada's fallback examples, this feature cannot export an arbitrary repository request. Each step's blocker is explicit in the UI. A user cannot make a request ready by ticking local checkboxes or asserting a green CI badge.

## Displayed states

- `SELECT_REPO` or `CATALOG_UNAVAILABLE`: no real repo selected
- `HEAD_INSPECTION_REQUIRED`: not observed, malformed/mismatched identity, stale or future observation
- `CONTRACT_REQUIRED`: inspected repo needs a scoped local contract
- `SOURCE_MOVED_REBIND`: observed HEAD moved after contract creation
- `CONTRACT_REVIEW_REQUIRED`: malformed/ineligible or authority-forged contract
- `REQUEST_READY_FOR_LOCAL_EXPORT`: source-aligned, valid request **can be downloaded locally**, not executed

The lane shows source HEAD, contract SHA, the number of *locally reviewed* checklist items and **0 independently verified checks**. These labels do not assert that any repository is finished.

## Scope, boundaries, and implementation

- UI: `src/completion-lane.jsx`, shown before nested Evidence Bay in `src/mission-board.jsx`.
- State helper: `src/completion-lane.mjs`; reuses `signalsFresh`, `contractProgress` and the strict `prepareVerificationRequest` instead of duplicating a weaker validator.
- Actual download: the existing `downloadVerificationRequest` in `src/main.jsx` is reused, not bypassed.
- No new GitHub endpoint, credentials, browser fetch, automatic fleet scan, server, cloud job, direct workflow dispatch, release action or merge action.
- Existing R19–R24 evidence and R25 live triage are unaffected.
- 15 regression tests verify stale and forged input refusal, moved source, wrong numeric repo ID, malformed checklists, R8 request non-authority, and visible Mission Board integration.

## Next bounded pilot

Pick a real repository with an understood deliverable. Complete its source-bound contract and export one request. **Before** claiming a completion, the next engineering increment needs a real Agentora request intake, execution receipt, independent reviewer and release/merge human approval. None of those results are invented here.

**A desk earns FINISHED only after independent acceptance evidence at the exact source SHA.**
