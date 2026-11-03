# R17 · Accessible modal background isolation from real R14 evidence

## Verified failure: run 41725853210

The operator manually ran **PhiMada R14 Live Accessibility Audit**
on 2026-11-03 against deployed PhiMada main commit
\`db0868f5cf8b34d2d6a9737cdd40a4df7cac7eed\`.

Source: https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/41725853210

The first attempt finished with workflow exit code 2, because the axe
scanner correctly reported accessibility findings, **not** because
Chromium, GitHub or the runner failed. The receipt was downloaded from the
original artifact \`phimada-r14-accessibility-41725853210\`,
artifact ID \`13273976896\`; its ZIP SHA256 matched GitHub's recorded digest:

\`88ccac17c2704a79f02fbc7156985fdb8909b4b153a72c384b713d5e3d2f6f27\`

Findings, scoped to three scanned views:

| View | Definite violation-rule findings | Incomplete axe rules | Keyboard checks |
| --- | ---: | ---: | --- |
| Office | 0 | 3 | not separately scored |
| Open repository inspector | 1 | 3 | not separately scored |
| Mission Board | 0 | 3 | not separately scored |
| **Total** | **1 (affecting 11 nodes)** | **3 rules per view** | **6/6 passed across journey** |

The **only definite** rule was \`color-contrast\` in the open inspector
with class hints \`.desk-grid\`, \`.desk-vacant\`, \`.desk-slot\`,
\`.desk-label\`. These are **vacant-desk labels behind the open modal**,
not text inside the inspector. The overlay dims the office, and the
background remains exposed to axe without an inertness boundary.

The three incomplete rules for every view were
\`aria-prohibited-attr\`, \`color-contrast\`,
and \`label-content-name-mismatch\`. They **remain open for manual review**.
No claim of WCAG conformance is supported.

## Fix: isolate the background when the inspector is open

- \`src/main.jsx\`: apply the browser-standard \`inert\` property to the
  page header and the office workspace **only while a repository inspector
  is selected**. The inspector is rendered as a sibling outside those inert
  regions and retains its existing \`role=dialog\`, \`aria-modal=true\`,
  Escape handler, focus trap and close button.
- The underlying desk grid and other controls are no longer active
  Tab/click/accessibility navigation surfaces while a true modal is open.
  They become interactive again when it closes.
- Capture the initiating desk/minimap element **before** React makes the
  office inert (the inert transition can itself blur the active button).
  Pass this saved opener to the inspector and restore focus safely on close.
- \`scripts/r14_live_a11y_audit.mjs\`: observe actual inertness of
  \`header.topbar\` and \`.workspace\` in the live browser and confirm the
  dialog is **not** inside an inert subtree before the inspector axe scan.
  If it is not isolated, record a failure. **Do not disable any axe rules
  or discard contrast reports.**
- \`tests/r17-modal-background.test.mjs\`: six regression tests for
  rendering, focus, actual live-scanner guard, pre-inert opener capture,
  continued incomplete-rule review and unchanged WCAG tags.

This fix does **not** change R14's strict result semantics:
any definite violation, incomplete axe rule, source mismatch, keyboard
failure or runtime error prevents an automated clean result.

## Next operator check

After the R17 PR is reviewed, merged and the Pages workflow succeeds,
manually run
[the existing R14 audit](https://github.com/MichaelWave369/PhiMadaPrime/actions/workflows/r14-live-accessibility.yml)
with **the then-current main SHA** and
\`RUN_PHI_MADA_A11Y_AUDIT\`.

Compare the newly uploaded R14 JSON (even if red) with run 41725853210.
Expected result is that the irrelevant background vacant-desk contrast
finding disappears from the inspector scan; this is a **hypothesis to
verify**, not a claimed outcome.

Any remaining incomplete rules still require actual investigation and
human assistive-technology/keyboard acceptance. The workflow is
manual-only, retains a seven-day artifact, and grants no merge, dispatch,
accessibility certification or product-completion authority.
