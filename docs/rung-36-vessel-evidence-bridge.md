# R36 · SuperPhiVessel Evidence Bridge in PhiMadaPrime ThinkTank

## Scope and location

Open PhiMadaPrime → ThinkTank → **Evidence & Trust**. R36 is an **operator-selected, browser-memory-only, read-only verification surface**, not an agent connection. It consumes two existing, unmodified PhiLearn/SuperPhiVessel formats:

- philearn.signed-skill-passport.v1 (R10 envelope containing an R8 philearn.skill-passport.v1).
- philearn.r10.trust-store.v1, **supplied separately by the receiver** after independently authenticating the public key.

Source contracts in SuperPhiVessel:
- interop/skill-passport-verifier.mjs (R9/R8 synthetic six-case replay).
- interop/r10-signed-passport.mjs (R10 Ed25519 signing message).
- interop/r11-enrollment.mjs, interop/r12-governance.mjs, interop/r13-witness.mjs (explicitly out of R36 verifier scope).

The bridge does **not** fork the producer's schema or forge a new proof format. Its browser verifier independently replays the exact six public synthetic scenarios; checks R7 and R8 SHA-256 digests; validates receiver-selected R10 trust-store schema, Ed25519 DER SPKI public-key fingerprint, active issuer/scope pin; and checks R10's original Ed25519 signature bytes with Web Crypto.

A passing result is **R10_SIGNATURE_VALID_INSPECTION_ONLY**: a pinned signing key signed one internally consistent synthetic passport. It is **not** verified real model execution, model identity, genuine human identity, external source provenance, or empirical capability evidence. A rehashed forged synthetic scenario still fails replay. Without independently pinned key material, even a valid R8 passport produces **UNPINNED_SIGNATURE**, not cryptographic success.

## Operator workflow

1. Obtain a public-synthetic R10 signed Skill Passport from the original offline PhiLearn/SuperPhiVessel protocol. No keys, models, or receipts are bundled in the public ThinkTank.
2. Separately authenticate the issuer key fingerprint through an independent trusted channel; prepare an operator-controlled R10 public trust-store JSON. Do not accept a key merely because its sender supplies it with the evidence.
3. Open **ThinkTank → Evidence & Trust** and select the signed JSON (max 320000 bytes). Optionally select the independently pinned trust store (max 16000 bytes).
4. Click **Inspect evidence**. Read the precise labels. All results preserve authority NONE, permissions [], model execution proven NO, and approvals NO.
5. Click **Clear files & result** or reload the page. Neither evidence nor trust-store bytes are stored by this panel or uploaded.

The checker accepts only expected schema shapes and refuses extra envelope/trust-store properties, changed synthetic trace replies, mismatched model labels, broken digests, unknown or mismatched public keys, and invalid signatures. The UI will not display raw source traces, prompts, private keys or the full trust store. Do not import secret/private material into this static public page.

## What R36 deliberately does NOT do

- **R11:** no enrollment registry verification or inspection approval.
- **R12:** no operator event-chain validation, independently pinned checkpoint validation, or revocation handling.
- **R13:** no independent witness receipt verification, rollback floor or historical head attestation.
- No FlashProve/zkSNARK model inference verification, no agent identity authentication, no real model execution, no verified product completion.
- No local runtime gateway, API keys, agent dispatch, repository writes, PR approval/merge, external fetches triggered by inspection, automated promotion, or permissions.
- The existing Mission Board R18–R33, Agentora evidence, R35 ThinkTank teams, and Vessie runtime remain independent.

For R11–R13, run original offline SuperPhiVessel command-line verifiers against their full required files and protected receiver-side trust/checkpoints. Do not feed a claimed R12/R13 success boolean into PhiMada and label it verified. A future R37 can correlate independently authenticated evidence, with new tests and human review.

## Verification and field acceptance

Run from PhiMadaPrime:

    npm test
    npm run build

The R36 test suite generates a fresh real Ed25519 keypair, makes six canonical R8 synthetic scenario records, computes both digests, signs the original R10 message, and checks that valid signatures pass while forged traces, rehashed replies, mismatched pins, changed signature bytes, authority flags and oversized data fail closed. This is test-fixture cryptography, not a third-party producer integration.

After GitHub Pages deploys merged source, run a real browser acceptance using an operator-created R10 synthetic passport and independently pinned trust store. Confirm Chrome/Edge supports Ed25519 Web Crypto, the expected success and refusal states, keyboard and mobile layout, clear/reload behavior, and that DevTools shows no verification-triggered network requests. CI build alone is not deployed-browser acceptance.

The bridge is intentionally a first trust rung, not a claim of live Vessie integration.

**Capability ≠ authority. Ledger above ego.**
