# Φ Verified Pipeline Factory R42: GMED × WITNESS local receipts

R42 is a Phase 2 extension of the R41 public-GitHub observation bridge.
It imports **two local JSON documents manually**. It does not run either
producer, fetch from GitHub, verify a cryptographic signature, or dispatch work.

## Preparing the files

1. Export a GMED `gmed-report:v1` using GMED's existing browser inspector
   or `node scripts/gmed.mjs MichaelWave369/BTM PR_NUMBER`.
2. Export a PhiTriBrain369 Rung 4a snapshot with exact, allowlisted WITNESS
   claim IDs and optional WEAVER/STEWARD records. Only choose sources safe
   to display locally. The content can include sensitive quote material.
3. Open PhiMadaPrime → ThinkTank → Pipeline Factory → GMED × WITNESS receipt desk.
4. Manually select each file. Each remains in browser memory until cleared.

The GMED report's included check/status rows, row grades, totals, reported
verdict, PR identity, merge SHA and observed time are checked for internal
consistency under the real GMED v1 format. Unsupported keys, fake authority,
bad totals, fabricated row grades, timestamp problems and oversized files
are rejected. Consistent GMED reports remain **unsigned self-reports**:
a malicious file can manufacture a convincing set of rows. The checker
does not requery GitHub or certify pagination completeness.

The PhiTriBrain snapshot uses the existing R38 strict parser, including
the original Python-compatible content SHA-256 check. This is only an
integrity/self-consistency check, not an authenticated source guarantee.
R42 also fixes the old R38 source-id validator: actual PhiTriBrain
`BrainStore.ingest` generates `src_` followed by 24 hex characters.

## Optional metadata alignment

When both files pass their respective local parsers, the UI looks for
explicit WITNESS GitHub reference strings with both the same repository
name and the same commit SHA as the GMED receipt's **merge commit**.
The output can say MATCHING_COMMIT_REFERENCE_TEXT or
NO_MATCHING_COMMIT_REFERENCE. It cannot prove that the cited source
actually existed, was faithfully quoted, or represented a test.

GMED verifies a reported merged PR SHA, not necessarily the current default
branch HEAD. The existing R41 public HEAD inspector remains separate and
should be used when current HEAD matters. Neither interface grants merging.

## Trust and permission boundary

- A consistent GMED local file is not an independently authenticated GMED run.
- A matching snapshot digest is not a digital signature.
- A matching WITNESS commit string is not proof of repository/source identity.
- No test command, job log or original source body is independently replayed.
- Approved STEWARD review status does not authorize execution.
- Neither file can set required_checks_verified, merge_authorized or any
  permissions to true. The UI never writes back to either producer.
- R40 synthetic fixtures are rejected by GMED's real receipt contract.

## Acceptance

Run `npm test` and `npm run build`. Regression tests cover forged authority,
tampered verdicts, fabricated check rows, wrong SHA/PR, old receipts, invalid
snapshot source IDs, missing or mismatched references and the no-authority
contract. Browser smoke test both local file selectors and clear action.
The existing Mission Router, R36 Evidence & Trust, R37 Council Provenance,
R38 Three-Brain Ledger, R40 simulator and R41 live CI desk remain intact.

Future signed provenance and truly independent GMED re-observation require
their own authenticated trust contracts. R42 does **not** claim them.
