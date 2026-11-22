# Muse × PhiMadaPrime R45: partner interoperability handoff

**Contract target:** PhiMadaPrime R45 signed provenance verifier (unchanged).
**Status:** Public-only, fixed cross-language test vector; **no real Muse identity signed this fixture**. Muse's future purpose-specific \`muse sign phi-gmed-receipt\` interface remains an external dependency.
**Authority:** NONE. This contract never grants repository writes, agent execution or delegation.

## What Gabriel's Muse implementation needs to produce

Given an **unchanged** original \`gmed-report:v1\` JSON byte sequence, sign a strict R45 claim using its registered, protected Muse human identity key. The Muse signer must not expose an arbitrary-message signing command or leak a mnemonic or secret key.

The output envelope must have **only**:

- \`format: "phi.gmed.signed-provenance.v1"\`
- \`algorithm: "Ed25519"\`
- \`issuer_id: <explicit exact label>\`
- \`key_id: "sha256:" + SHA256(RFC8410 Ed25519 SPKI DER public key, 44 bytes)\`
- \`signed_at: timezone-aware ISO 8601\`
- \`claim_base64: canonical padded base64 of exact UTF-8 claim JSON bytes\`
- \`signature_base64: canonical padded base64 of the 64-byte Ed25519 signature\`

Decoded claim must contain **only** \`format\`, \`scope\`, \`repository\`,
\`pr_number\`, \`merge_sha\`, \`report_sha256\`, \`observed_at\`, \`authority\`,
and \`permissions\`, as strictly specified in the
[R45 contract](verified-pipeline-factory-r45-signatures.md).
The scope is \`GMED_V1_REPORT_DIGEST_ONLY\`, \`authority="NONE"\` and
\`permissions=[]\`. \`report_sha256\` is SHA-256 of the **exact original GMED
bytes**, including whitespace and trailing newline if present. Never hash
a normalized/reparsed JSON object.

**Signed message bytes:**

\`\`\`text
PHI-GMED-REPORT-PROVENANCE-ED25519-V1
<issuer_id>
<key_id>
<signed_at>
<claim_base64>
\`\`\`

The five lines above have \`LF\` separators and a final \`LF\` after
\`claim_base64\`. The angle-bracket placeholders are replaced with
literal values without spaces or quotes.

**Muse fingerprint difference:** Muse's \`sha256:...\` identity fingerprint
is based on **raw 32-byte** Ed25519 public key bytes. R45's \`key_id\` is
SHA-256 of a **44-byte DER SPKI** consisting of the 12-byte prefix
\`302a300506032b6570032100\` followed by that same raw key.
Do not copy the Muse raw-key fingerprint into the R45 \`key_id\`.

## Fixed test vector for both engineering teams

\`tests/fixtures/r45-muse-python-public-vector.json\` contains only:

- A raw 32-byte public key in canonical \`ed25519:<base64url>\` form.
- Its Muse raw-key SHA-256 and derived R45 SPKI SHA-256.
- A synthetic \`MichaelWave369/R45MuseSynthetic\` GMED report and its literal JSON string.
- A strict R45 envelope with an Ed25519 signature generated with an ephemeral
  Python \`cryptography\` key in memory.

**No Muse production identity, no actual GitHub PR, no production private key.**
This is a **protocol test vector**, not a Muse product-conformance certificate.

To replay it in the existing PhiMadaPrime JavaScript verifier:

\`\`\`bash
npm install --no-audit --no-fund
node --test tests/r45-muse-python-public-vector.test.mjs
\`\`\`

The test independently confirms Node \`crypto.verify\` **and** browser-compatible
R45 Web Crypto verification over the exact same Python-produced signature.

## Go/no-go contract for a real Muse test

Once a Muse release with the specific command is published and the team provides
an actual signed sample:

1. Capture exact **Muse version**, command invocation, selected hub, public
   identity key and fingerprint, and signature output. Do not capture any
   mnemonic, passphrase, seed, agent key or keychain dump.
2. Independently check the intended public key belongs to the claimed hub
   identity, including active key status and rotations where available.
3. Preserve original GMED bytes without normalization.
4. Use the existing R45 browser desk and local read-only CLI:
   \`scripts/check-r45-muse-interop.mjs\`. Do **not** modify the R45 verifier
   to accept an unverified alternate wire format.
5. Require valid signature math for correct bytes, rejection of changed report,
   wrong key, wrong repository or SHA, invalid signed time, extra permissions,
   and exact domain mismatch.
6. Record exact-head CI and offline evidence. Publicly report any failures
   or incompatible fields without silently translating signed data.

A successful signature binds a key to the receipt bytes and specified source
identifiers. It is **not** proof that the described GitHub operation happened,
that the signer is the claimed human, or that a worker had authorization.

## Known limits and request to Muse

The team hasn't supplied a released CLI signature example to this repo yet.
Before testing with the actual Muse command, it would help to confirm:
- Public-key export syntax and fingerprint representation for the selected hub.
- Exact shape of the signed JSON envelope emitted by the purpose-specific command.
- Issuer-label convention, signing timestamp serialization and trailing newline.
- Whether the CLI signs a preexisting GMED report file without changing its bytes.

Please share **public test artifacts only**. No phrase, private key, or secret
file is necessary to verify this protocol.
