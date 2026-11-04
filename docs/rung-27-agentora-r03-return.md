# Rung 27: Agentora R0.3 original-request intake return

## What this adds

PhiMada's **One Repo · Finish Lane** can already download a strict R8, exact-SHA verification *request* for any real public repo. The existing [Agentora Fleet R0.3 intake](https://github.com/MichaelWave369/Agentora/blob/main/docs/FLEET_R03_VERIFICATION_INTAKE.md) accepts that file **offline**, but only produces a local `verification-intake.json` with `HELD_FOR_OPERATOR_REVIEW`, `independent_checks_run:0`, and all approval/merge flags false. It does **not** run code or fetch current GitHub HEAD. Its only bounded pilot runner, R0.6, still targets **PhiMadaPrime specifically**.

R27 brings the R0.3 receipt back into the **same selected project lane** rather than adding another nested Evidence Bay or pretending that a receipt is a passing test.

## Operator steps

1. In [PhiMada Prime](https://michaelwave369.github.io/PhiMadaPrime/) open **Mission Board → One Repo · Finish Lane**. Select a real repo in the public catalog.
2. Inspect its GitHub HEAD and scope a **Project Completion Contract** at its desk. Use **Download governed request** once the source and contract align. Retain the **exact original downloaded JSON bytes**.
3. In a local Agentora checkout with Python 3.12+, run:
   ```bash
   python scripts/fleet_r03_acceptance_intake.py \
     --input /path/to/phimada-verification-request-REPO.json \
     --output-dir local-fleet-intake
   ```
4. Return to the **same** repository's Finish Lane. Expand **Agentora R0.3 receipt return · local acknowledgement only**.
5. Import the original PhiMada R8 request into field 1 and Agentora's `local-fleet-intake/verification-intake.json` into field 2. Click **Correlate original request + R0.3 receipt**.
6. Inspect the local acknowledgement and any source/contract drift. It must say **0 independent checks run** and **HELD FOR OPERATOR REVIEW**, even if the exact request digest matched.

The two files remain local in browser memory. Switching selected repos resets the file input/review component. Clear review explicitly discards selected file references and the displayed local review.

## What actually gets checked

`src/agentora-r03-return.mjs` compares the SHA-256 over the **exact original request bytes** with the receipt's `request_sha256`. This is a file-linkage check, **not a signature** and **not proof Agentora produced the receipt**. All files are treated as untrusted inputs. It also checks:

- 64-KiB original request and 96-KiB intake JSON limits; valid UTF-8 and strict top-level known fields
- Real selected public catalog repository owner, canonical name and numeric ID, plus default branch and exact 40-hex SHA
- Original R8 request's precise `NOT_DISPATCHED`, `NOT_RUN` and `false` approval claims
- Request surface types and ordered checks against PhiMada's actual `CONTRACT_TYPES` matrix (same matrix as Agentora R0.3)
- Receipt schema `agentora.fleet.verification-intake.v0.3`, `HELD_FOR_OPERATOR_REVIEW`, and exact repo, SHA, branch, timestamps and surfaces
- Every check `verification_state: NOT_RUN`, `evidence_receipt: null`, with the original review checkbox flag and correct manual-versus-automation-candidate classification
- Strict `independent_checks_run:0`, `head_revalidated_by_agentora:false`, `digest_is_authentication:false`, `verified_complete:false`, `operator_approved:false`, `dispatch_authorized:false`, and `merge_authorized:false`
- Plausible timezone-aware original source/preparation and receipt timing
- **Current context is separate**: a recently observed real GitHub HEAD may match or have moved, and the current local contract may align or differ. Rechecked when the view updates, not frozen as a successful result.

## Trust and implementation

The local result is `ORIGINAL_REQUEST_AND_LOCAL_R03_RECEIPT_CORRELATED`, not `VERIFIED` or `PRODUCT_COMPLETE`.

Both files are local, unsigned and not independently authenticated as originating from Agentora. Someone able to forge both files can make a matching digest. The value of this feature is operator-facing **lineage consistency and refusal of false authority flags**, not remote cryptographic provenance.

No API network request, GitHub write, job dispatch, merge, release, test execution, code checkout, or Council inference occurs in this feature. Agentora's R0.3 CLI remains separate, offline and user-triggered. The existing R0.6 runner is still a **single fixed PhiMada** pilot and must not be represented as fleet-wide execution.

### Follow-on required for a finished project

A fleet-wide governed runner with per-repo explicitly approved source and checks, independent live GitHub source identity, isolated check execution, immutable evidence receipts, and human release/merge acceptance must be built and tested separately. Acknowledging intake **does not** shorten that list.

## Tests

`node --test tests/agentora-r03-return.test.mjs` includes 18 negative and boundary cases. Regular project CI and isolated Chromium preview must also pass. Existing R19–R24 original-artifact and Council paths remain unchanged.
