# Φ Verified Pipeline Factory · Rung 1: Visual Architect

This is an offline **design** editor in the existing PhiMadaPrime ThinkTank.
It uses @xyflow/react (already installed) and Zod 4 for a versioned strict
document format. It is NOT a LangGraph runtime, execution system, GMED
verifier, network client or agent dispatcher.

## Quick start

Open PhiMadaPrime and choose ThinkTank → Pipeline Factory. The default
sample uses Break The Matrix CI review: request → plan → evidence → verify
→ human review → result. Drag stages, connect handles, select/edit labels,
add/remove nodes, or restore the example. View validation warnings in the
inspector. Import a selected local JSON design or export a valid one.
Neither action uploads, runs a test, persists a session or sends a command.

## Contract

- document_kind: PHI_VERIFIED_PIPELINE_DRAFT
- schema_version: 1
- mode: DESIGN_ONLY
- execution: status NOT_RUN, enabled false, permissions empty
- Allowed stages: request, plan, evidence, verify, review, result
- Maximum 16 nodes, 30 edges and 64 KiB imported JSON
- Exactly one request and one result
- Directed acyclic graph with all stages connected
- **Every** path from request to result must traverse evidence,
  independent verification and human review in that order

A design passing schema and topology checks receives
DESIGN_VALID_NOT_RUN, never VERIFIED. A visual verification node
does not mean any test executed; a human review node is not
a person's approval. Even a validated graph is not a proof of truth.

Untrusted text is rendered via ordinary React text interpolation, never
as HTML. No browser storage or persistent network actions are added.

## Future rungs

R2: deterministic offline simulator and clearly labeled *synthetic*
receipts for missing, forged, failed and independently checked tests.

R3: explicit, read-only adapters for exact-commit GitHub CI receipts,
GMED verification, and WITNESS quote-cited evidence. Results without
real execution evidence MUST remain NOT VERIFIED.

R4: optional local runtime adapter (LangGraph.js is a candidate),
authenticated least-privilege worker execution, separately authorized
human approval, hash-linked execution history and recovery. Neither
the current editor nor the pipeline JSON grants such capabilities.

## Acceptance

Run npm install, npm test, npm run build.
Then manually check desktop and mobile layout, stage dragging, edge
connections, JSON export/import, keyboard controls and isolation from
the existing Mission Router, Evidence & Trust, Council Provenance,
and Three-Brain Ledger rooms.

**Rule:** if tests did not actually execute, no pipeline may claim VERIFIED.
