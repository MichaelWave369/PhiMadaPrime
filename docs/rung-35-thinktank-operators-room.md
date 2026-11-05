# R35 · PhiMadaPrime ThinkTank Operators Room

This rung turns the visual mockups into a **responsive React UI inside the existing living fleet office**. Open the **ThinkTank** sidebar tab. It does not replace the original 12-desk/floor office, the Agentora Mission Board, the PhiBot Crew Deck, the Chronicle, or existing evidence gates.

## Included screens

1. **ThinkTank**: Vessie, Gaia, BrainC, PocketBrain; selectable role cards; visual orchestration hub; real observed catalog/proposal counts.
2. **PhiBots**: seven role blueprints and a proposed review pipeline. These are *not* live/invoked workers.
3. **Repo Health**: searchable public catalog with on-demand exact-HEAD CI observations. Unknown, stale, pending, failure and observed-green are separate states.
4. **Build Queue**: observed CI evidence and Agentora planning queue remain separate. No invented runners, percentages, ETA, or merge readiness.
5. **Human Oversight**: session-local review/pinning and existing Agentora handoff format. No remote approval, write permission or dispatch is granted.
6. **Ori Council**: a **separate** role team (Ori Prime, Scout Ori, Forge Ori, Guardian Ori, Pocket Ori), not a renaming of the four core operators.
7. **PocketBrain**: responsive phone/tablet/wrist *preview* with summary information; no wearable pairing or authenticated device action.

## Data and security contract

- Reuses existing `rows` from the GitHub public catalog, `signals` from user-triggered GitHub API inspections, and `missions` from the validated Agentora plan.
- An example-only or fallback catalog is not a live repo verification source.
- Exact repository ID and full name must match for observed CI evidence to count.
- A 15-minute freshness cutoff is inherited from `signalsFresh`.
- A green exact-head workflow observation is **not** proof of required checks, functional operation, successful deploy, or permission to merge.
- Locally marking a mission reviewed is not an authenticated approval. `handoffText` explicitly requires external human review and authorized workflow.
- **Zero network writes or credentialed agent calls** were added by this rung.

## Acceptance

- Existing office and Mission Board remain reachable.
- New ThinkTank sidebar tab opens all seven internal views without a second router.
- Repo Health can call the existing user-triggered `inspectLiveRepo` path.
- Review and pin buttons use the existing session-local state handlers.
- Internal tabs are keyboard-accessible buttons and screen status is text-based, not color-only.
- New pure-model tests enforce authority boundary and honest observation counts.
- Build with `npm run build`; run `npm test` and the repository's existing CI before merge.

## Future integration

Only after separately authenticated adapters and explicit operator approval: real worker presence, signed mission dispatch, run receipts, permission-gated merges/deployments, and Gen.E-Wrist companion transport. Until then, all agent/persona displays are role design sketches.
