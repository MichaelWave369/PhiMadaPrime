# R34 · PhiBot Crew Deck

R34 adds a lazy-loaded PhiBot Crew Deck to PhiMadaPrime Mission Board,
grounded in five *real, public PhiBot example manifest files*.

## Operator workflow
1. Open Mission Board, expand R34 PhiBot Crew Deck.
2. Click Inspect published crew. This explicitly performs five bounded public
   GET requests, with credentials omitted, to pinned PhiBot example sources.
3. Inspect the roles, model declarations, memory configuration, capabilities
   and declared authority values. Open View pinned source for provenance.
4. Copy a review-only handoff if useful. It carries no execution power.

## Source and provenance
Repository: MichaelWave369/phibot
Immutable source commit: fda4ac026756742bab07be03695e59caf3f57195
Allowlisted manifests: scout, local-scout, repo-scout, patch, utility, all
under bots/examples. Upstream changes do not silently move this pin.

## Security and truth
- Published example definitions do not prove deployed, installed, online, or
  running bots. A gated-write declaration is not an issued Reality Gate grant.
- The public site has no local runtime adapter, token, secret, model, scheduler,
  repository write permission, worker enrollment or dispatch capability.
- Manifests are fetched only on a user click, by exact fixed paths with a
  fixed 40-character commit. No arbitrary URL input or background polling.
- Data are size-limited and projected through strict identity and capability
  validation; invalid/unavailable sources are shown as such, never assumed
  to represent offline workers.
- Five definitions loaded is not five agents running. The two zero counters
  describe verified activity *within this viewer*, not external runtime state.
- Public source text and the clipboard handoff grant no authority.
- An authenticated runtime bridge must be a separately reviewed localhost-only
  operator service, never a private backend silently exposed by GitHub Pages.

## Test and manual acceptance
Run npm test and npm run build. Confirm invalid identities, malformed permissions,
oversized or missing data, pinned source rules, no credentialed fetches and honest
no-runtime claims. After merge/deploy, manually check Pages in Chrome including
offline, mobile, keyboard focus, API errors and no unexpected network calls.

## Next
R35: separate authenticated local PhiBot runtime bridge with operator-only UI.
R36: digest-bound human-approved dispatch, receipts, and Reality Gate controls.
No scheduling, grants, PR writes or merges are authorized by R34.
