# R38 · PhiTriBrain369 Three-Brain Ledger in PhiMadaPrime

This rung connects two **existing, separate projects through a local file contract**. It does **not** create a live API, subscribe to GitHub events, authorize agents, or turn STEWARD reviews into execution permission.

- Producer: **PhiTriBrain369 Rung 4a** command `phitribrain bridge`, available after its PR #11 was merged.
- Consumer: **PhiMadaPrime → ThinkTank → Three-Brain Ledger**, an independent room in the existing ThinkTank.
- Data path: operator picks a local JSON file. The browser reads and checks it **in memory**.
- No backend, network transfer, localStorage, sessionStorage, uploaded file, automated agent, reviewer action or job dispatch was added.

## Generate an explicit source snapshot

From the PhiTriBrain369 repository, first choose non-sensitive claim IDs from a scope, using its scoped CLI to inspect and verify quote-backed evidence.

Create a JSON manifest with EXACT selected IDs:

~~~json
{
  "schema_version": 1,
  "consumer": "PhiMadaPrime",
  "scope": "PhiOS",
  "claims": ["clm_REPLACE_WITH_REAL_ID"],
  "relations": [],
  "decisions": []
}
~~~

Relationship and decision evidence dependencies must also appear in `claims`. The producer refuses implicit expansion. It limits a snapshot to 20 claims, 10 relationships, 10 decisions, and 256 KB.

Then export a **new** local file (no overwrites):

~~~bash
phitribrain bridge --manifest ./my-bridge-manifest.json --output ./tri-brain-snapshot.json
~~~

This creates a local file only; it does not send anything to PhiMadaPrime.

## Inspect the file in PhiMadaPrime

1. Open PhiMadaPrime's existing virtual office.
2. Open **ThinkTank → Three-Brain Ledger**.
3. Select the exported `tri-brain-snapshot.json` with the local file picker.
4. Review the three lanes:
   - **WITNESS:** claim text, verbatim excerpt, source locator, line/offset, observed age, asserted valid-time status, and source warnings.
   - **WEAVER:** proposed relation, linked claim statements, method, and current review annotation.
   - **STEWARD:** decision rationale, selected WITNESS evidence, review attestation metadata, and an explicit **NO EXECUTION AUTHORITY** boundary.
5. Use **Clear loaded evidence** to discard the imported snapshot from React state. Navigating away from the room also unmounts it.

The viewer never contacts the PhiTriBrain369 database. No file path is persisted or uploaded.

## Validation and provenance

The browser enforces:

- Exact Rung 4a schema version, `PhiMadaPrime` consumer label and one valid scope.
- Explicit WITNESS / WEAVER / STEWARD lanes and small finite record counts.
- Claim ID shape, source hashes, quote offsets, valid-time metadata, and bounded source strings.
- Relationship and decision references pointing only to WITNESS records included in the file.
- All declared write, network, tool, deployment and autonomous-action flags **false**.
- Correct **SHA-256 of the original producer's canonical JSON content**, using Python-compatible stable key ordering and handling of its rounded `source_observation_age_days` floating-point field.

**Important:** this digest only checks that the included document content is consistent with its included checksum. An attacker who can rewrite the JSON can recompute its checksum. The R4a snapshots are **unsigned**. A matching checksum is not proof of who produced the file, the reliability of the claims, the accuracy of the reviewer identity, or the current repository state.

The producer does not include the full original source bodies. Thus this viewer **cannot independently reproduce the reported source SHA-256 or verify that each quote appears in the original**; the producer performed those checks at export time. Open the original WITNESS ledger and pinned source when stronger assurance is required.

Imported text is rendered as escaped React text content, never HTML or executable instructions. External locators are displayed as text, not opened automatically.

## Local acceptance and negative tests

~~~bash
npm install
npm test
npm run build
~~~

The deterministic Node tests cover a Python-generated golden SHA-256 fixture (including the `0.0` case), modified content, wrong consumers, malformed provenance, missing explicit evidence, duplicated claim IDs, authority escalation flags, and file size limits. They also ensure the component is mounted in the existing ThinkTank.

A successful CI/build is not a full live-browser acceptance test. After merge, separately inspect the real page in desktop Chrome/Edge and test narrow/mobile layouts, keyboard navigation, actual PhiTriBrain369 export, and clear/reset. No runtime connection is claimed until separately developed and independently secured.

## Next steps

A future authenticated local service could provide a real, least-privilege read connection, independently pinned snapshot signatures and explicit operator-review workflows. Those are **not** included in R38.

**GMED Rule #377: The ThinkTank may read the ledger. It may not fire the engines.**

## R38 consolidation: preserve one viewer

The merged Three-Brain Ledger remains the canonical local import surface. A new
**Copy safe review summary** control includes only the scope, export timestamp,
three lane counts and reported digest, with explicit no-authentication and
no-execution caveats. It never copies claim text, source bytes or permissions.
The **Evidence & Trust** and **Council Provenance** buttons only navigate to
existing ThinkTank rooms. No independent parser, second TriBrain room,
automatic sync, network calls, or runtime permissions were introduced.

This incorporates the valuable operator workflow from competing PR #46 while
preserving the merged viewer and its existing R4a trust boundary.
