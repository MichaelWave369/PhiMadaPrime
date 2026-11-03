# R16: keyboard-safe repository inspector and live audit locator recovery

R15 improved the accessibility names of the repository desk buttons and the
mini-map touch targets. That was the right repair, but it changed the accessible
button names expected by the previously shipped **R12 Chromium smoke** and
**R14 live accessibility audit** runners. R16 repairs this test compatibility and
addresses a real untested keyboard risk in the repository inspector.

## Changes

- Repository inspector focus management now remembers the previously focused
  desk/minimap trigger on open and returns focus to that same still-connected
  trigger on closing (Escape, close button, or overlay dismissal).
- Tab and Shift+Tab stay within the modal inspector even when its content
  changes during public API updates, with the usual in-dialog tab order preserved
  between boundaries. Programmatically moved focus outside the modal returns
  to the close button. Focus-related listeners are installed once per mounted
  inspector, **not** restarted every time live data changes the parent's
  inline \`onClose\` callback.
- Reusable pure helpers in \`src/dialog-focus.mjs\` handle filtering currently
  visible, connected, non-inert focusable controls, choosing wrap destinations,
  and restoring the opener. This does not add DOM dependencies to Node tests.
- R12 and R14 Playwright scripts now use
  \`getByRole("button", { name: /Inspect repository:\\s*PhiMadaPrime/ })\`
  instead of an obsolete \`aria-label\` attribute selector removed by R15.
- R12 additionally checks that Escape restores focus to the initiating desk.
- R14's existing **manually launched** axe audit now includes **six** scoped
  keyboard checks, adding forward/reverse Tab containment and opener-focus
  restoration. A failing or missing check remains a review blocker. The
  exact-SHA deployment guard and the explicit human launch confirmation remain.
- The existing R14 test fixture and a new \`tests/r16-dialog-focus.test.mjs\`
  suite cover pure keyboard boundary logic, fail-closed source consistency,
  focus restoration and legacy test-runner selector compatibility.

## Historical evidence and safe operator workflow

The R15 merge deployed as \`5c6e2147d411eb7ca2680bca96d7d45c2a81a8e7\`
at the start of this rung. **No new R14 live audit was observed** after that
merge when R16 began, so the R15 accessibility repairs were not independently
verified on the live website. The earlier R14 red result was from the
pre-R15 SHA \`029d0b8fc07aa2fafd70349d645967056326d6a1\`.

After merging and deploying R16, run the existing manual
[PhiMada R14 Live Accessibility Audit](https://github.com/MichaelWave369/PhiMadaPrime/actions/workflows/r14-live-accessibility.yml)
from \`main\` with the **new current 40-character SHA** and explicit
\`RUN_PHI_MADA_A11Y_AUDIT\`. The artifact must be read even if the workflow is
red. R14 scans three UI views and reports both automated axe findings and
six keyboard checks. Findings cannot be silently cleared by unit tests or a
passing Vite build.

The browser evidence remains bounded, unsigned, per-source and explicitly
does **not** confer complete WCAG compliance, assistive technology validation,
product completion, autonomous workflow dispatch, or merge authorization.

## Verification

    npm test
    npm run build

The PR itself runs Node, Python and public fleet CI but **does not** run the
manual live-browser workflows or claim an observed deployed-UI result.
