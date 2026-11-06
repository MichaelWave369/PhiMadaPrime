# Φ Verified Pipeline Factory · Rung 2: Offline Verification Gate Lab

Rung 2 is a deliberately **synthetic** and deterministic fault-injection
exercise attached to the existing Pipeline Factory inside the ThinkTank.
It uses a fixed \`.invalid\` repository target and fake SHA/run IDs.
Nothing contacts GitHub, calls Ollama, executes a test, writes a database,
invokes an agent, grants permission or merges a PR.

## Try the scenarios

Open ThinkTank → Pipeline Factory → Verification Gate Lab.
Choose a scenario and select **Run offline simulation**.

- Synthetic complete test: a correctly formed fictional receipt.
- Missing receipt: no evidence of any run.
- Failed test: fictional nonzero exit status.
- Pending run: incomplete work cannot be called passed.
- Wrong commit: SHA does not match the fixed synthetic target.
- Test never ran: claimed success is contradicted by attempted=false.
- Wrong repository: the receipt belongs to another synthetic repository.
- Forged authority: an injected claim of approval and write access.
- Forged verified label: an injected assertion of real verification.
- Inconsistent exit code: claimed success but nonzero exit code.

A sample can return \`SIMULATED_GATE_ACCEPTED\`. That means only that
the **fictional** receipt passed this **fictional** gate policy. Every
report, including a simulated pass, remains
\`mode=OFFLINE_SYNTHETIC_ONLY\`,
\`actual_ci_verified=false\`,
\`actual_tests_executed=false\`,
\`human_review_completed=false\`,
\`merge_authorized=false\`, and
\`permissions=[]\`.

The backend result \`DESIGN_VALID_NOT_RUN\` from R1 is unchanged.
R2 never writes verification status into the pipeline document.

## Deterministic gate checks

The evaluator checks a strict Zod fixture contract and rejects unknown
fields. It checks pipeline ID, exact fictional repository, exact fictional
HEAD SHA, exact fictional test command, declared execution, declared
completion and consistent success/zero exit status. Failures are explicit
and never mapped to green.

A synthetic receipt may itself lie. The simulator only checks how a
gate *would* handle its fields and inconsistencies. It does not
authenticate a producer, use a signature, validate logs or prove any
code ran. Real evidence cannot enter through this simulator, and there
is no "verified" state or execution capability in this rung.

## UI guarantees

The simulator is shown below the existing React Flow graph and uses
operator-triggered buttons only. Its report is tied to the exact
in-memory design object and selected scenario. Moving a node, editing
the objective, adding an edge, or switching scenario invalidates the
displayed result until a fresh simulation is run. No persistence,
networking, API token, clipboard export or file upload is added.

## Acceptance

Run \`npm test\` and \`npm run build\`; inspect the 19 synthetic
regression tests and manually try all 10 scenarios in the browser.
The existing Mission Router, R36 Evidence & Trust, R37 Council
Provenance and R38 Three-Brain Ledger must remain intact.

## Rung 3 boundary

Only a separate, explicit read-only real-evidence adapter should
consume genuine provenance and exact-head CI observations. It must
distinguish a GitHub-reported check from the test procedure that ran
and from a human authorization decision. This synthetic evaluator
must **never** become a real signature verifier or permission grant.

Rule: **If the test did not execute, the system must never report
real verification, no matter how confidently a model says it did.**
