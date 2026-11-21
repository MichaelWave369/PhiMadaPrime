# R45 × Muse public-key interoperability experiment

**Status: implementation proposed in draft PR; disposable-key tests only.**
**Real Muse CLI signing: NOT YET TESTED.** The `muse sign phi-gmed-receipt` interface is being developed by the Muse team; neither its final arguments nor its release availability are assumed here.

This is an extension of **PhiMadaPrime's existing R45 Signed Provenance Gate**, not a new trust system or repository.

## Goal

Accept the original GMED `gmed-report:v1` file and an R45-format, domain-separated Ed25519 envelope **signed by an existing Muse identity**, then verify it with the unchanged [R45 verifier](../src/verified-pipeline-signed-provenance.mjs).

A passing result proves only that the supplied public key verifies the signature over the exact R45 message bytes, and that the reported GMED file matches the signed claim. Establishing whether that key actually belongs to an intended Muse identity requires independent evidence. It does **not** prove GMED/CI ran, source was built, agent execution occurred, or any action was authorized.

## Already implemented

- [Public-key adapter](../src/verified-pipeline-muse-interop.mjs) accepts only a 32-byte, unpadded base64url **public** Ed25519 key (optionally prefixed `ed25519:`). It rejects PEM, extra fields and noncanonical encodings.
- It computes both a Muse fingerprint, `sha256(raw_32_byte_key)`, and the separate R45 `sha256(RFC8410_SPKI_DER_44_bytes)` key ID. The values are **not equal**, but bind to the same key bytes.
- It checks the supplied Muse fingerprint before generating an **operator pin file in memory**, with explicit issuer and repository scoping. This is key consistency, **not independent key authentication**.
- The collapsed **Muse public-key adapter** appears inside the existing R45 signed provenance desk. No new site-wide route or writable backend.
- [Local CLI](../scripts/check-r45-muse-interop.mjs) reads two local files and a public key and invokes exactly the existing R45 verifier.
- [Synthetic regression tests](../tests/verified-pipeline-muse-interop.test.mjs) use **ephemeral test-only keys** in memory. No persistent keys, fixtures with private material, credentials, or seed phrases.

## Why a Muse signed commit is not an R45 receipt

Both systems use Ed25519, but Ed25519 verifies a signature over **exact bytes**. Native Muse commit, MSign, or attestation signatures do not sign R45's domain-separated envelope automatically. The Muse side must specifically sign R45's message using the existing secure signing path, without an arbitrary-message signing API.

R45 expects:

```text
PHI-GMED-REPORT-PROVENANCE-ED25519-V1\n
<issuer_id>\n
<key_id>\n
<signed_at>\n
<claim_base64>\n
```

There is exactly **one final newline**. The placeholders are each replaced with the literal ASCII field values; `claim_base64` encodes the exact UTF-8 claim JSON bytes. Do not reserialize the claim between signing and verification.

The strict envelope schema, signed-claim schema, time relationship and operator pin schema are documented in [R45's existing contract](verified-pipeline-factory-r45-signatures.md), which remains unchanged.

## Proposed operator workflow when Muse releases the signer

1. Generate/export a **real, original GMED v1 JSON receipt** for an allowed `MichaelWave369/<repo>` PR. Keep the file bytes identical.
2. Obtain the intended Muse identity's **public** Ed25519 key and its 32-byte raw-key SHA-256 fingerprint through an independent, authenticated channel. Do not use a key solely because it accompanied the signed receipt. Check key registration and rotation/revocation state when supported.
3. Use the Muse team's released **purpose-specific** `muse sign phi-gmed-receipt` flow. Follow its official release documentation. It must produce an R45-compatible envelope and sign with the protected Muse identity key. This project does not invoke a signer.
4. In PhiMadaPrime: **ThinkTank → Pipeline Factory → GMED × WITNESS receipt desk → Signed provenance gate**, import original GMED report and signed envelope. Expand **Muse public-key adapter**, enter the raw public key, fingerprint, exact envelope issuer label and report repository, then select **Use public key as local R45 pin**.
5. Select **Inspect signed provenance**. Confirm matching report digest, Ed25519 verification and operator key pin. Keep operator independent-pin confirmation unchecked unless it was genuinely performed.
6. For reproducibility, run the local CLI from a trusted checkout, using **only public key data**, the original report, and the detached signed envelope:

```bash
node scripts/check-r45-muse-interop.mjs \
  --report ./local-only/gmed-report.json \
  --envelope ./local-only/muse-r45-envelope.json \
  --public-key 'ed25519:PUBLIC_BASE64URL_ONLY' \
  --muse-fingerprint 'sha256:RAW_32_BYTE_KEY_SHA256' \
  --issuer-id 'musehub:registered-handle' \
  --repository 'MichaelWave369/EXAMPLE'
```

Never pass a mnemonic, passphrase, derived seed or private key. Never commit a real receipt that contains sensitive data. The CLI accesses no network and does not mark historical or current CI as passed.

## Acceptance matrix

| Case | Expected outcome | Evidence |
| --- | --- | --- |
| Canonical raw 32-byte Muse-style Ed25519 public key | Correct 44-byte SPKI + two different matching-format fingerprints | Synthetic test |
| Wrong Muse fingerprint | Public-key adapter refuses input | Synthetic test |
| Invalid/private-key-looking material | Adapter refuses input | Synthetic test |
| Synthetic R45-format receipt signed by disposable Ed25519 key | Existing R45 verifier reports valid mathematical signature; issuer unauthenticated | Synthetic test |
| GMED report modified after signing | `REPORT_BINDING_MISMATCH` | Synthetic test |
| Signed payload claims a different merge SHA | `REPORT_BINDING_MISMATCH` | Synthetic test |
| Different signing key | `INVALID_SIGNATURE` | Synthetic test |
| Unauthorized permission claim | `INVALID_SIGNED_ENVELOPE` | Synthetic test |
| Real receipt signed by released Muse `phi-gmed-receipt` command | **PENDING: no released example observed by this PR** | Requires exact Muse CLI version, output bytes, public key verification and an operator-reviewed test |

## Security boundary and follow-ups

- **No Muse identity access** from the web UI, no keychain reads, signing, token issuance, agents, background requests, remote writes, delegates, approvals or permission grants.
- R45 reports remain `issuer_identity_authenticated=false`, `original_gmed_producer_authenticated=false`, `ci_execution_proven=false`, `merge_authorized=false`, `deploy_authorized=false`, `permissions=[]`.
- The public-key adapter does **not** claim that checking a copied fingerprint against a copied public key proves ownership.
- No permanent trusted Muse root is bundled. A locally generated operator pin does not equate to an authoritative trust store.
- Once Gabriel publishes the signing command and an approved example, test its exact envelope bytes, payload domain, public-key export, fingerprint type, timestamp format, and key rotation behavior. Any mismatch must fail visibly, not be papered over by an alternate verifier.
- Only after a successful real-world handshake should agent identity / delegation enter consideration. That work is explicitly **out of scope**.

Sources: [Muse identity docs](https://musehub.ai/muse/identity), [Muse getting started](https://musehub.ai/muse/getting-started), [PhiMadaPrime R45 contract](verified-pipeline-factory-r45-signatures.md).
