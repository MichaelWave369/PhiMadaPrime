# ΦMada Prime

**An armada of Φ software. One living virtual office.**

ΦMada Prime is a playful, **read-only React command tower** for the public `MichaelWave369` GitHub repository fleet. It does not execute agents, change code, merge pull requests or call private GitHub APIs.

## Rung 1: Twelve desks per level

- **Exactly 12 workstations per floor:** six along the upper wall, six along the lower wall. Vacant seats remain visible on the final level.
- **Automatic skyscraper growth:** public repositories are fetched from the fully paginated GitHub public owner endpoint. Each twelve additional stations automatically creates another floor.
- **First floor: flagship bridge:** Agentora, PhiOS, BTM, FieldConstellation, PhiServe, SuperPhiVessel, PaperGhost, Blackout, RacetoOblivion, Domistika, SparkTheSubstrate and PhiOperator, when available.
- **Working elevator:** floor directory, previous/next buttons, and left/right keyboard arrows. Search filters desks, with floor counts recalculated.
- **Clickable desk inspector:** repository metadata, GitHub link, optional HTTPS homepage, and any safe imported Fleet evidence.
- **Local-only evidence handoff:** import an exported `fleet-audit.json` (Agentora R0.1) and/or `fleet-plan.json` (Agentora R0.2) into the browser. Nothing is uploaded, cached, or published.
- **Pixel-art identity:** original HTML/CSS virtual office with characters, workstation monitors, Chief of Staff / Fleet Control, cozy lounge, arcade and retro details. No external art or fonts.
- **Responsive and accessible:** keyboard-operable desk stations and elevator, visible focus outlines, reduced-motion settings, inspector Escape handling.

## Run locally

Node.js 22 or newer is recommended.

```sh
npm install
npm test
npm run dev
npm run build
npm run preview
```

The production build uses relative asset paths so the same static files work under `/PhiMadaPrime/` on GitHub Pages and from another mounted subdirectory.

## Publish on GitHub Pages

After the Rung 1 PR is merged, open repository **Settings → Pages → Build and deployment** and choose **GitHub Actions**. The `Publish PhiMada Prime` workflow builds and deploys on commits to `main`. Once GitHub Pages reports success, the expected address is:

https://michaelwave369.github.io/PhiMadaPrime/

**Do not assume that address is live until the actual deployment succeeds.** CI building a bundle is not a browser acceptance test.

## Truth and privacy boundaries

The public GitHub API is used to discover and display **public owner repositories only**. API pagination must exhaust successfully, or the office falls back to **12 explicitly labeled curated examples**, never a deceptive partial "full" inventory. It uses no personal access tokens.

Desk lights show evidence presence, not code health: **UNVERIFIED**, **AUDIT FOUND**, **NOT AUDITED**, **ARCHIVED**, or **EXAMPLE**. None of these means finished, merged, released, running, or tested on-device.

An imported report is validated against schema, owner, public visibility, repository identity and no-authority flags. Private input and dispatchable tasks are rejected. Source data remains untrusted: SHA/time metadata is *not* independent verification. Audit/plan data is kept in temporary React memory, not uploaded and not stored between sessions. The public office never publishes private repository names or contents.

This visual application is **not a CI orchestrator, agent runtime or work dispatcher**. The backend stays with Agentora, and future authorization must remain separate from this display.

## Roadmap

- **R1 (this PR):** multi-floor pixel office, GitHub public inventory, local Agentora audit/plan inspector.
- **R2:** building zones, floor minimap, project relationships, better status provenance, inventory snapshots, project assignment views.
- **R3:** optional authenticated read-only Agentora gateway with approved data contracts and private/local-only deployment mode.
- **R4:** human-approved job dispatch, exact-SHA checks, independent validation and governed PR handoff.
- **R5:** optional shared VR/XR tower via PhiOS XR and Gen.E-Wrist, without silently inheriting merge authority.

**Build outward. Circle back. Compile forward.**


## Rung 2: The Living Tower

Rung 2 adds **editorial themed office departments**, not source-certified dependency groups. The first floor still contains the twelve flagship projects. Remaining public repositories are assigned exactly once to ΦOS Systems, XR Workshop, Arcade Foundry, Research Observatory, Creative Studio, Network Operations, Workshop & Utilities, Infinite Commons, or Discovery Annex. Every department uses dedicated floors with exactly twelve physical desk slots, so incomplete floors can have vacancies and the total floor count can exceed the minimal ceiling of repository_count / 12.

### Explore

- Elevator directory lists real departments and how many desks are occupied on each level.
- The floor ribbon includes a clickable twelve-desk minimap.
- Pixel workers are bigger, and the office has color-themed rooms, decorations, idle animation and an actual Chief of Staff briefing.
- The Chief displays the **first review-only priority** from an imported Agentora R0.2 plan. Without an imported plan, it explicitly says that no actual jobs have been queued.
- On a repository inspector, choose **Check current CI and PRs** to read live public GitHub metadata: repository identity, the default-branch head SHA, up to twelve recent workflow runs, and up to ten open PRs.
- A worker visibly celebrates **only when an on-demand observation of recent workflows matching the exact branch head reports success**. This is a decorative notification of partial CI evidence, not proof that all required checks passed or that the product actually runs.
- Live observations expire for display purposes after fifteen minutes. Refresh from the desk inspector to update. GitHub API failures result in an unknown state, not a green status.
- Browser accessibility includes keyboard controls, strong focus indicators, motion reduction and a scrollable inspector.

**Rung 2 safety contract:** The app still has no GitHub write token or ability to push code, create issues, merge PRs, dispatch workers or run CI. Live reads are on demand for one selected public repo, never a 222-repo uncontrolled fetch. The Chief is a read-only reviewer, not an executor. Every repository remains visible even when its editorial category is uncertain. Private repository names, imported private reports and claim-of-authority fields are rejected.

### Acceptance

Run `npm test` and `npm run build`. Test changing several floors, clicking map locations, importing an Agentora plan, inspecting live GitHub CI on one desk, and reduced-motion mode in a browser. A green CI build of this code alone is **not** confirmation that the deployed interface has passed a manual browser check.


## Rung 3: Fleet Mission Board (read-only)

The Mission Board turns an imported Agentora Fleet R0.2 plan into a navigable review surface:

- Open **Mission Board** from the top navigation or the Missions tab. When no plan is loaded, the board explains how to produce `fleet-plan.json` from Agentora's read-only Actions workflow, instead of inventing tasks.
- See the **complete bounded Agentora queue**, no silent truncation after the first 200 entries.
- Filter by project name, check, department and local review state. Pin items and mark them **reviewed locally** without changing anything on GitHub or Agentora.
- Select **Visit desk** to return to the relevant themed floor and inspect the public repository.
- Select **Copy review handoff** to copy an explicitly non-executable text summary with the project, task, observed source commit and snapshot date. The operator must review current HEAD, required CI and acceptance evidence before creating a real job.
- Re-importing a new plan resets local pin/review flags; the board never says a task was completed, approved, merged or dispatched.

The Mission Board is a client-side React surface. It uses only the existing public repository catalog and manually imported public-only JSON. **There are no new GitHub API reads, API tokens, mutations, background tasks or dispatch permissions.** Pin and review decisions live only in React memory for the current browser session. Reloading the page clears them.

The module `src/missions.mjs` has deterministic queue IDs, public-repository binding, source-SHA tracking, filters, session-only triage counts and explicit non-authorization handoffs. `tests/missions.test.mjs` tests the trust boundary, search, priorities, duplicate task handling and an imported 230-task plan.

### Field acceptance

After merging, validate in the deployed browser: open the Mission Board with no plan loaded, import a public R0.2 plan, inspect the full job list, filter by department, pin and mark locally reviewed, copy a review-only handoff, visit the correct project desk, and confirm browser refresh clears local annotations.

**No job is verified complete** by any of the R0.1, R0.2 or R0.3 views. Verification and governed dispatch remain separate Agentora work.

## Rung 4: Automatic Public Pilot Evidence Feed

The living office no longer requires a manual JSON import to see **a small, explicitly bounded Agentora pilot**. After this rung is merged and GitHub Pages successfully publishes, the static site automatically loads a **public-only, read-only, SHA-256-checked** Agentora R0.1 audit and R0.2 review plan. The pilot covers six named Agentora projects, not the entire public fleet, even though the directory includes every public repo.

### Source-of-truth and deployment

The Publish PhiMada Prime GitHub Actions workflow now:

1. Builds PhiMada Prime and runs safety tests.
2. Checks out public Agentora at the **pinned immutable commit** 502115508421eb1c98a6c05a79d04a9e432b8b27, not an unreviewed future main revision.
3. Runs Agentora's original public-only **pilot** scanner and review-only planner using an Actions token with read permission.
4. Runs scripts/verify_public_fleet.py to reject private rows, incomplete catalog coverage, stale reports, forged completion, unsupported schemas and any executable or merge-authorized plans. Its validated JSON is copied into dist/fleet with an SHA-256 integrity manifest.
5. Publishes the static app and public pilot together via GitHub Pages.

The workflow runs on pushes to main, manual dispatch, and daily at **16:35 UTC**. GitHub scheduled workflows may be delayed or skipped. This is a periodic refresh attempt, not continuous monitoring. A scan or validation failure stops deployment, leaving the prior successful Pages site as-is.

### Browser behavior

The browser reads only three relative same-origin files: ./fleet/manifest.json, ./fleet/fleet-audit.json and ./fleet/fleet-plan.json. It checks their hashes, applies the existing public-only Agentora schema checks and rejects snapshots older than 30 hours. No private repo API, access token or GitHub mutation is involved.

The sidebar shows actual pilot coverage and publication time. A locally imported Agentora report takes precedence for the current session. **Load published pilot** explicitly switches back to the snapshot; it does not launch a new scan or workflow. The Mission Board distinguishes the published pilot from manual imports. Local review flags reset only on explicit reload/reimport.

**Status boundaries:** The public inventory may contain 222+ repositories, while the pilot deeply audits only six. An unscanned desk is NOT AUDITED, not healthy or complete. Neither published snapshot nor Mission Board dispatches agents, merges PRs, runs CI, alters Agentora or certifies that a release functions.

### Acceptance

- Run npm test, the Python unittest suite in tests/test_public_snapshot.py and npm run build.
- PR CI also performs a **real public pilot audit** with the pinned Agentora code before testing the publication gate.
- After merging, verify the Pages deployment, visible pilot coverage, Mission Board proposals without manual JSON upload, manual override and explicit stale/unavailable behavior.
- Broader fleet-wide public evidence needs separate rate-limit and privacy review. Do not publish private data or infer that an old CI result proves functionality.

## Rung 5: Rolling Public Fleet Coverage

The six-project Agentora pilot remains the **completion-planning** source. Rung 5 adds a separate, progressively growing **whole-public-fleet metadata observation ledger**.

### Operating schedule and coverage

- Each successful Pages publication runs an additional bounded cohort of **24 public repositories**, selected oldest-observed-first. Public inventory is fully enumerated first, but metadata deep checks are limited to 24 per publication. A PR CI test uses **8 public repos** for bounded validation.
- Observations use the pinned, public Agentora R0.1 scanner. This is not a new merge engine, and neither scanner nor office acquires write credentials.
- Previous public observations are carried forward from the existing published coverage ledger, but only for repository IDs and names that still appear in the **current public owner inventory**. Anything missing from the current public inventory is dropped from the newly published ledger.
- Recently changed repos, observations older than 14 days, and partial API observations are distinctly marked **stale**, **age-expired**, or **limited**. 90-day-old history is discarded. A repository with no valid observation is **never observed**, not broken.
- At 24 unique projects per successful daily run, an unchanged set of 222 public repos could be observed over roughly **10 daily publications**. GitHub schedule delays, API limits, new repos, failures and edits change actual coverage. The counter is earned, not forecast as completed.

### Browser view

The **Coverage** sidebar tab shows total public repos, ever inspected, recent clean observations, limited/stale and never scanned. It also includes floor-by-floor observation coverage and links back into the tower elevator. Individual desks show a separate rolling scanner record, exact observed commit and metadata evidence. The floor ribbon has a coverage progress meter.

The existing **Mission Board remains sourced from the six-repo Agentora R0.2 pilot**. Scanning a repo in the rolling cohort does not automatically create a task, trigger CI, or indicate product completion. The pilot and rolling coverage are separate data layers.

### Security and correctness

- The coverage JSON is validated and distributed as a **public Pages asset** with SHA-256 integrity metadata added to the existing public pilot manifest. No private repos, tokens, secret artifacts or authenticated browser session data enter the site.
- The browser trusts only same-origin published JSON and rechecks freshness against the current public inventory where available; changed projects are not called recently verified.
- The prior coverage ledger is fetched only from the exact allowlisted public PhiMada Pages path. If the ledger is absent (first deployment), a new scan begins. Other fetch failures halt publication rather than falsely claiming accumulated history.
- All displayed statuses are **metadata observations, not functional release verification**. No CI pass or site HTML response can mark a repository complete.
- CI runs Node tests, Python coverage retention/privilege tests, and an actual 8-repo public cohort against the pinned scanner.

### Field acceptance

After PR merge and Pages deployment, open **Coverage** to verify a scan of up to 24 public repositories on the first run and view explicit never-observed desks. Verify the next successful scheduled publication carries forward prior observations. Check one known recently changed repo to confirm stale evidence is not labeled healthy.

GitHub Pages is a public site. A repository made private after publication can have historical public data cached until the next successful update; do not publish any sensitive information in the first place.
