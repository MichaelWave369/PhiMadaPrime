# R37 · Council Provenance: two independent evidence rails

## Operator path

Open **PhiMadaPrime → ThinkTank → Council Provenance**. The new room continues R35/R36's evidence-aware, strictly **review-only** UI rather than introducing an agent runtime.

R37 compares three distinct things without promoting one into another:

1. A human-selected council seat among the actual four R35 operator blueprints (Vessie, Gaia, BrainC, PocketBrain) and five separate Ori Council blueprints.
2. A categorical **R36 result** from browser-local verification of a PhiLearn/SuperPhiVessel R10 Ed25519-signed R8 **synthetic** passport. Only the small result summary is passed between the two ThinkTank rooms in React state.
3. An **on-demand GitHub-owned Agentora R1 execution record** verified by the existing strict public, GET-only reader in src/autonomous-turn.mjs. The operator supplies an R1 PR number and the exact expected **output** commit SHA. This room corroborates either that PR's tested SHA or independently read-back merge SHA. It rejects a task **source** SHA offered as proof of worker output.

The second and third records are **independent**. Neither R10 nor Agentora R1 currently binds the R10 passport envelope hash to a GitHub R1 task/PR/run. Thus R37 always displays:

- Council seat identity: NOT AUTHENTICATED.
- R10 → Agentora cross-source binding: NONE.
- AI model execution and individual AI agent identity: NOT PROVEN.
- Real inference/FlashProve: NOT PROVEN.
- Product completion: NO.
- Authority: NONE; permissions: []; actionAllowed: false.

## How to inspect

1. In **Evidence & Trust** (R36), import a public synthetic R10 signed Skill Passport and receiver-owned independently pinned R10 public-key trust store. Click **Inspect evidence**. Its underlying R36 verification must succeed to show a signed passport in R37.
2. Switch to **Council Provenance** using ThinkTank navigation. Select a role blueprint for contextual human review only. Selection cannot mint identity or invoke that role.
3. Optionally enter a numeric, existing **Agentora Autonomous Turn R1** pull request number and the full lowercase 40-character SHA of its tested PR head or merged output. Click **Verify R1 output**.
4. R37 calls the **same fixed Agentora R1 reader** used by R31. It checks trusted repository ID/ownership, GitHub Actions receipt, task digest, owner environment approval, controller workflow/job, required CI checks, immutable SHA linkage and merge readback as applicable, before accepting the result. There is no alternative URL, user-supplied JSON or fallback that claims success.
5. Review each rail and the always-absent cross-source link. **Copy bounded review-only handoff** exports only categorical statuses and safe public GitHub reference metadata, never imported R10 bytes, private keys or prompts. Clearing the run discards its checked result. Closing/reloading the ThinkTank discards both rails.

The fixed GitHub reader may reject historical runs that no longer satisfy its strict, current-state contract. A missing or failed read is **HELD**; never infer old provenance or a currently running worker.

## Privacy and boundary

- R36 files are read by the browser, never uploaded, stored, or sent to GitHub.
- R37 sends **GET-only** requests to fixed public GitHub API endpoints only when the operator explicitly checks an Agentora R1 PR. No other repo or public HTTP URL can be supplied.
- Council seat labels do not represent active connected models. Signed R10 model/issuer labels are *not proof a model ran*.
- Agentora R1's historical deterministic preapproved editing pipeline is *not proof that a neural model generated the code*.
- No session backend, database, browser-storage persistence, token, approval, agent dispatch, shell command, merge, deployment or privilege is added.
- R11/R12/R13 protected checkpoint/witness verification is still an offline SuperPhiVessel responsibility and is **not** silently accepted from imported strings.
- R31's separately SHA-bound Chronicle verifier remains the strongest full commit-history-specific trace within the existing Mission Board. R37 is an additional bounded readback focused on two adjacent provenance rails, not a replacement.

## Tests and acceptance

From the PhiMadaPrime repository:

    npm test
    npm run build

The R37 tests assert all nine council blueprint identities, R10 non-promotion, PR/commit SHA validation before API calls, strict R1-shaped results, source-vs-output refusal, foreign/forged claims rejection, and explicit absence of cross-source proof even when both independent rails are valid. Tests mock the existing GitHub reader and do **not** count as live GitHub corroboration.

After merge, open the deployed ThinkTank and test both rooms, R36 signed evidence import, R37 role switch, malformed PR/SHA refusal, a known real Agentora R1 result, copy handoff, browser reload, keyboard navigation and mobile layout. Confirm Network shows only expected explicit read-only GitHub GET calls during R1 verification and none on R36 import.

**Next research gate:** producer-authenticated domain-separated council task receipts with immutable R10 envelope hash, run/task/input/output SHA, independently pinned participant keys, anti-replay policy, and a separate trust/consent process. Do not claim this link exists until a real producer and verifier both demonstrate it.

Capability ≠ authority. Ledger above ego.
