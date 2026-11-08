# PhiMada Prime R2: Agentora logical steward advisory view

**No agent execution.** This release adds a second, explicitly local file
import in the RepoNerve tower tab for the matching Agentora R2 export
("agentora.fleet.steward-advisory.v1").

Workflow:
1. Local RepoNerve completes a scan.
2. Agentora's R1 bridge exports the public-only observations and R2 ingests them.
3. The operator runs:
   python scripts/fleet_stewards_r2.py snapshot --output ./stewards-public.json
4. Operator reviews the public-only file, then imports it into PhiMada Prime's
   RepoNerve tab. No upload, external network call, private inventory, or
   credential access occurs.

The imported data shows persistent *logical* stewards by immutable GitHub IDs,
archival pauses and previous **advisory** rotation counts. It never describes
any steward as a running model, any turn as an executed job, or any repo as
verified finished. The parser rejects unknown fields, private data, foreign
IDs, stale snapshots and mismatches with the current public GitHub catalog.

This is an explicitly non-executable display and is not a scheduling API,
worker authorization tool, auto-merge switch, CI verifier or public feed.
