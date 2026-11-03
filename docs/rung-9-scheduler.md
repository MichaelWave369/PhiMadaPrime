# PhiMada Prime R9: causal concurrency planning preview

R9 is a **local, review-only scheduling simulation** in the Mission Board. It builds on the SHA-pinned Agentora planning and contract work without impersonating a distributed lease service, creating worker jobs, or bypassing GitHub branch protections.

## Workflow

1. Open the Mission Board after a recent valid Agentora plan is loaded.
2. Expand **Parallel Desk Planner** and select up to 12 simulated concurrent repo slots.
3. Optionally enter explicit \`Project needs Dependency\` lines (for example, \`BTM needs OverStrings\`), then validate them against the current public catalog. Self-dependencies, unknown/private projects, malformed lines and graph cycles are rejected.
4. Observe the first **simulated** wave, overflow backlog, and evidence-blocked groups. Each repo gets at most one slot even if Agentora proposes multiple checks for that repo. All tasks for a repo must agree on the exact source SHA.
5. Dependent work remains held until an independent verifier can supply a verified completion receipt. Neither a source code relationship nor a locally checked box counts as that receipt.

## Fail-closed rules

- Stale/missing Agentora plans, missing/conflicting revision SHAs, explicit unverified dependencies, and locally simulated occupied repos are held. Plan age is reassessed when the planner recalculates.
- The simulation doesn't claim actual worker leases or remote reservations. Preview concurrency is bounded to 1–12 project groups; other groups wait.
- All outputs have zero dispatched jobs, zero actual workers, zero independently verified completions, and \`mergeAuthorized=false\`.
- The local merge-gate helper never authorizes a merge. Future Agentora workers must acquire atomic server-side leases, pin exact Git commits, verify required checks and independent receipts, enforce branch protection/reviews, and revalidate immediately before merge.
- User-entered dependency rules are browser-session only. No telemetry, token exchange, GitHub writes, build dispatch, or persistence is added.

## CI / field acceptance

\`npm test\` includes scheduling tests for grouping, prioritization, bounded slots, unknown dependencies, cycle detection, missing/mixed source revisions, stale plans, reservations, and always-closed merge gates. \`npm run build\` must succeed. Inspect the Mission Board in the deployed Pages app and confirm that expanding the planner does not push the twelve-desk first screen below a giant new header.

## Next governed rung

Implement actual lease issuance and verification receipts in Agentora's authenticated workflow rather than in public GitHub Pages. Preserve the distinction between **advisory schedule** and **executed/verified work**.
