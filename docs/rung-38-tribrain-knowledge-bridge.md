# R38 · PhiTriBrain369 Rung 4a → PhiMadaPrime ThinkTank

**Two repositories, one bounded, read-only operator workflow.**

- Source: [PhiTriBrain369](https://github.com/MichaelWave369/PhiTriBrain369), local Python/SQLite WITNESS/WEAVER/STEWARD store.
- Viewer: [PhiMadaPrime](https://github.com/MichaelWave369/PhiMadaPrime) → ThinkTank → Φ TriBrain 369.
- Protocol: the existing PhiTriBrain Rung 4a JSON schema_version 1 in src/phitribrain/operator_bridge.py. No new export format.

## Operator steps

1. Work locally in PhiTriBrain. Import a non-sensitive note and create exact quote-anchored claims. Optionally record relationships and decisions.
2. Prepare a Rung 4a manifest targeting PhiMadaPrime in ONE scope, listing exact existing IDs. Up to 20 WITNESS claims, 10 WEAVER relations, 10 STEWARD decisions. Include every supporting claim of a selected relation or decision.
3. Preview with phitribrain bridge --manifest operator.json. Inspect sensitive text and paths before export.
4. Export with phitribrain bridge --manifest operator.json --output phi-operator-snapshot.json. The producer refuses to overwrite an existing file.
5. Open PhiMadaPrime → ThinkTank → Φ TriBrain 369, select that JSON, and click Inspect three-brain snapshot.
6. The viewer checks bounded JSON shape, exact consumer label, source-anchor metadata, unique sorted IDs, cross-lane dependencies, required no-action flags, and SHA-256 of the Python canonical JSON serialization.
7. Read WITNESS / WEAVER / STEWARD separately. Copy only the bounded categorical summary. Clear the evidence or reload to discard imported records.

Producer documentation: https://github.com/MichaelWave369/PhiTriBrain369/blob/main/docs/OPERATOR_BRIDGE.md

## Trust semantics

Rung 4a uses a **self-consistency digest, not a cryptographic signature**. Anyone able to edit the file can recompute it. A passing import is R4A_DIGEST_CONSISTENT_UNAUTHENTICATED, NOT authentication of PhiTriBrain, the OS user, any model or human, original source content, or factual truth.

WITNESS has attributed quoted claims, SHA-256 identifiers and line/character offsets, but R38 cannot independently replay original source bytes because they are not exported. WEAVER links remain proposals, even if reviewed. STEWARD decisions remain local annotations even when status says approved. No action permission follows.

The source_observation_age_days property is a Python float which may be integral (e.g. 1.0). JavaScript's usual serializer would turn it into 1, causing a false mismatch. The R38 canonicalizer reproduces Python sorted-key UTF-8 compact JSON and the integral float .0 representation. Regression tests include a digest created independently by Python.

## Security/privacy boundary

- No automatic sync, listener, background worker, GitHub scanner, server, MCP endpoint, or model invocation.
- Browser reads only the operator-selected local 256 KiB maximum file; no upload, localStorage, cookie, network fetch or source database write occurs from the new panel.
- Untrusted text renders as React text, never executable HTML/Markdown. Imported external URLs are NOT clickable from this viewer.
- R36 signed evidence, R37 Agentora GitHub provenance, and R38 local memory snapshots are three **separate** sources of evidence. R38 is not cryptographically bound to R36 or R37.
- No model identity authentication, approval, ΦBot dispatch, merge, deployment or authority.
- Avoid importing sensitive material into an untrusted browser/environment.

## Tests / acceptance

From PhiMadaPrime:

    npm test
    npm run build

Tests exercise Python digest parity, tampering, rehashed evidence that still remains *unauthenticated*, forged permission fields, orphaned dependencies, invalid citations, duplicates and oversize. Also run manual deployed-browser acceptance with a **real PhiTriBrain-produced Rung 4a export**, and verify lane rendering, mobile/keyboard behavior, no upload, explicit copy and clear/reload.

Future signed/authenticated local service integration requires separate producer signatures, independently pinned trust, anti-replay, operator consent, and local process boundary tests. Do NOT claim these in R38.

**GMED Rule #376: The bridge carries receipts, not launch codes.**
