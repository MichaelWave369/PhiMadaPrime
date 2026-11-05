# Φ World R1 · Multi-Agent Trust Gauntlet

## Scope
A local, deterministic **toy simulation** inside PhiMadaPrime, accessible from
the **Φ World** side tab. It does not call real models or agents, connect to
PhiBot, use GitHub credentials, dispatch jobs or execute any outside-world tool.

Inspired by multi-agent safety questions raised by Emergence World research.
This is an independent implementation, not a replication of their data,
code or claimed model-specific results.

## Operator flow
1. Open the Φ World tab in the live virtual office.
2. Choose cooperative commons, resource scarcity, forged authority or mixed
   collision. Pick 1–15 days and a repeatable numeric seed.
3. Run with independent policy enforced or permissive simulated execution.
4. Select **Compare both policies** to run the *same scenario, seed and duration*
   under both modes. The decision ledger shows the enforced run.
5. Filter the event ledger by denied requests, simulated incidents, or
   environment events. Export the complete JSON evidence on request.

## Trust boundary
Every synthetic request is treated as untrusted *data* and routed through
`policyDecision`. In enforced mode it denies stealing, sabotage, forged admin
authority, secret exposure, and audit tampering before any synthetic side effect.
A local per-agent capability allowlist controls ordinary actions; it also
checks funds and target constraints. Permissive mode deliberately drops the
independent safety deny rules **inside the toy state only** for comparison,
never for external tools.

The event log is in transient browser memory. Its "tamper" scenario flips a
synthetic state indicator but intentionally retains the investigator's event
list. The log is **not cryptographically protected or durable**. Exporting
downloads JSON locally and does not upload it.

## Validation / limitations
- `node --test tests/trust-world.test.mjs` checks determinism, fail-closed
  invalid configuration, zero hostile side effects with enforced policy,
  full retained evidence in permissive tamper scenarios, and a peaceful baseline.
- `npm test` and `npm run build` cover the integrated app.
- This is a teaching and design exercise, **not a security certification**.
  The outcomes of scripted agents cannot be generalized to model vendors.
- A future authenticated runtime bridge would require a **separate server-side
  policy authority**, explicit approved grants, audit persistence, and independent
  adversarial testing. Browser-side UI rules are not a substitute.
