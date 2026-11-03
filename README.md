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
