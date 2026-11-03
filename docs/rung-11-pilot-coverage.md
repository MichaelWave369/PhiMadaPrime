# ΦMada Prime Rung 11: source-aligned pilot coverage matrix

Rung 11 adds a **read-only acceptance-coverage breakdown** below the existing R10 Agentora Evidence Bay result on the Mission Board. The prior R0.6 workflow, R0.7 evidence ZIP review, and R10 GitHub API correlation remain necessary. R11 *does not* add another execution path or any implicit completion/merge authorization.

## Purpose

A green R0.6 pilot is real test/build evidence, but a "web app is done" claim requires many more checks. For the fixed PhiMada Prime pilot, the **only automated contract items that R0.6 reports** are:

- \`production_build\`: fixed \`npm run build\` returned zero
- \`automated_tests\`: fixed \`npm test\` returned zero

The existing \`web_app\` acceptance contract also requires \`browser_interaction\`, \`accessibility\`, and \`deployed_revision\`. None were performed by R0.6. Multi-surface contracts (e.g. WebXR) carry additional required hardware, interaction and comfort checks, all remaining uncovered.

## Behavior

1. An operator runs R0.6 manually, validates the ZIP using Agentora R0.7, then uses R10 to import the R0.7 JSON and original artifact ZIP and click **Corroborate**.
2. R11 inspects the resulting **in-memory** R10 correlation object and the **in-memory local completion contract** for PhiMada Prime (repository ID \`1443845098\`). No external writes or localStorage.
3. If the contract is present, includes the \`web_app\` surface and matches the exact pilot source SHA, and the GitHub artifact/run/current-HEAD correlation is good, R11 labels just the two automated checks **R0.6 EXIT 0 REPORTED**. All others are **NOT COVERED**.
4. Without a prepared contract, R11 shows a **suggested web-app checklist only** and a button that opens the PhiMada repo desk to create a local contract. No evidence is credited.
5. On source movement, unverified metadata, an incompatible surface or a mismatched contract SHA, R11 disables crediting and explains why. All local operator checkboxes remain unchanged.
6. The matrix *always* exposes \`independentlyVerifiedChecks=0\`, \`completedChecks=0\`, \`productVerified=false\` and \`mergeAuthorized=false\`. Even a correlated ZIP plus run is not browser or release acceptance, nor an independently rerun test suite.

## Trust boundaries

The R0.7 review JSON is operator-supplied and unsigned. The R10 browser hash corroborates the original ZIP bytes against public GitHub's artifact digest and validates workflow-run provenance, but R10 does **not** parse the archive's internal preflight/step/final JSON. The Agentora R0.7 CLI must check those contents separately. R11 is therefore a **coverage preview of reported check outcomes**, never a count of independently certified acceptance checks.

A local contract may have human-reviewed notes, but those cannot upgrade reported outcomes into accepted checks. The matrix never writes to contracts, changes source SHA, authorizes dispatch or merges, or certifies a completed product.

## Tests

    npm test
    npm run build

R11 introduces \`tests/pilot-coverage.test.mjs\`, with 11 cases for valid web-app matching, no contract, conflicting SHA, stale HEAD, forged authority flags, incompatible repositories/surfaces, multi-surface required gaps, local checklist annotations and malformed contracts.

## Next rung

A scoped browser-interaction smoke test for the deployed PhiMada site can begin addressing \`browser_interaction\`; a separate accessibility audit and a strict revision-to-deployment mapping will still be required. Those future receipts must remain independently verified and per-SHA, with explicit operator review before any completion decision.
