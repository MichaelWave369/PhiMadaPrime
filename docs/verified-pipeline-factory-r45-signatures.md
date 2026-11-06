# Φ Verified Pipeline Factory · R45 Signed provenance verification

R45 adds a **local Ed25519 signature verifier** to the GMED × WITNESS
receipt desk, using the Web Crypto implementation already established for
Vessie's scope-limited R36 passports. The R36 verifier and its synthetic
Skill Passport trust domain are not reused as GMED signing authority.

## Operator steps

1. Import an actual original GMED `gmed-report:v1` JSON receipt in the
   local receipt desk. Keep its byte representation unchanged.
2. Choose a separately created R45 signed provenance claim JSON file.
3. Optionally choose a public-key pin file obtained through a separate
   channel. Independently check the issuer's SHA-256 SPKI fingerprint
   against an out-of-band trusted statement.
4. Optionally declare that the external fingerprint check occurred.
   This operator checkbox is NOT itself source authentication.
5. Choose **Inspect signed provenance** for local cryptographic checking.

Importing any file performs no network request, signing operation or
GitHub write. Changing the imported GMED receipt invalidates the previous
signature result and clears the selected signature/pins.

## R45 signed envelope format

Strict JSON envelope keys:

    format: phi.gmed.signed-provenance.v1
    algorithm: Ed25519
    issuer_id: an explicitly scoped public label
    key_id: sha256:<64 hex lowercase characters>
    signed_at: timezone-aware ISO 8601
    claim_base64: canonical base64 of UTF-8 claim JSON bytes
    signature_base64: canonical base64 of 64-byte Ed25519 signature

The decoded claim must have exactly:

    format: phi.gmed.provenance-claim.v1
    scope: GMED_V1_REPORT_DIGEST_ONLY
    repository: MichaelWave369/<repo>
    pr_number: positive integer
    merge_sha: 40 lowercase hex characters
    report_sha256: SHA-256 of exact raw GMED JSON file bytes
    observed_at: the exact GMED receipt timestamp
    authority: NONE
    permissions: []

Signature message bytes (UTF-8) are domain-separated:

    PHI-GMED-REPORT-PROVENANCE-ED25519-V1
    <issuer_id>
    <key_id>
    <signed_at>
    <claim_base64>

Each line is separated by a newline and there is a final trailing newline.
The application verifies the Ed25519 signature over **these bytes**, not
over a reserialized JSON object. For deterministic reproduction, retain
the exact encoded claim bytes. A changed claim must be re-signed.

## Operator key pin store format

Strict keys: `format=phi.gmed.operator-pins.v1`, `keys=[...]` (max 20).
Each entry: `issuer_id`, `key_id`, `public_key_spki_base64`, `repository`,
`active`. Public keys must be RFC8410 Ed25519 SPKI DER (44 bytes) and
the `key_id` must equal SHA-256 of the exact DER bytes, hex prefixed.
Keys are public data. **Never import or bundle a private signing key.**
The trust store is supplied by the operator and is NOT authenticated
merely because it has matching fields or accompanies the signed claim.

No trusted issuer is preconfigured. R45 deliberately does not generate
or persist an issuer private key, and it does not forge an official
GMED signature. Production signing belongs in a separate explicit
issuer-key-management rung, with lifecycle and rotation controls.

## Result meanings

- `INVALID_GMED_REPORT` or `INVALID_SIGNED_ENVELOPE`: unsafe input.
- `REPORT_BINDING_MISMATCH`: report digest, repo, PR, SHA or timestamp
  differs from the decoded signed claim.
- `NO_OPERATOR_KEY_PINS`: the claim matches the report, but no public
  key has been independently selected for checking.
- `INVALID_OPERATOR_PIN_STORE` / `NO_MATCHING_ACTIVE_PIN`: malformed,
  unscoped, inactive, duplicate or fingerprint-inconsistent pins.
- `INVALID_SIGNATURE`: Ed25519 signature does not verify against the pin.
- `SIGNATURE_VALID_UNAUTHENTICATED_ISSUER`: signature mathematically
  verifies with the selected key, but external issuer trust wasn't declared.
- `SIGNATURE_VALID_OPERATOR_PIN_DECLARED`: same cryptographic result;
  operator self-declares an independently verified public-key fingerprint.
  The app still cannot independently authenticate the person or organization.
- `CRYPTO_UNAVAILABLE`: Web Crypto is unavailable. Nothing is authorized.

All results retain `issuer_identity_authenticated=false`,
`original_gmed_producer_authenticated=false`,
`github_reobserved_here=false`, `ci_execution_proven=false`,
`required_checks_verified=false`, `merge_authorized=false`,
`deploy_authorized=false`, and `permissions=[]`.

## Test and trust boundary

Run `npm test && npm run build` plus the isolated Chromium workflow.
R45 tests create *ephemeral test-only* Ed25519 keys via Node crypto and
test tampered receipts, substituted SHAs, changed signatures, bad
fingerprints, inactive or mismatched pins, forged authority, key ambiguity,
missing Web Crypto and a valid malicious self-signed report.
No private key or trusted signer is committed to the repository.

This gate does NOT check the GitHub API, required branch protection,
test commands, source bytes, code execution or the correctness of software.
R43 and R44 remain separate opt-in observations. An unsigned file signed
by an arbitrary new key is still untrusted as a claim of GMED identity.
