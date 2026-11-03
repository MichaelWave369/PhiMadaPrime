# R15: Remediate first live R14 accessibility findings

The first manually authorized live R14 accessibility audit ran on **2026-11-03**, GitHub Actions run
[41720840423](https://github.com/MichaelWave369/PhiMadaPrime/actions/runs/41720840423),
for main SHA \`029d0b8fc07aa2fafd70349d645967056326d6a1\`.

The workflow itself succeeded at installing dependencies, opening real Chromium,
performing three axe scans and four keyboard checks, and uploading its receipt.
The **audit exit code was 2 because accessibility issues were detected**, not
because CI or axe crashed. The original artifact \`phimada-r14-accessibility-41720840423\`
has SHA-256 \`3f212e865eaecaafa54699df96d892197e79a40518c2e0d3922c17e30e15307d\`
as independently checked against GitHub Actions metadata.

## Evidence from the actual R14 artifact

| View | Rule categories with violations | Affected elements (by category) |
|---|---|---|
| Office | visible-label/accessibility-name mismatch; unlabeled form elements; target-size | 12; 2; 12 |
| Repo inspector | color contrast; visible-label/accessibility-name mismatch; unlabeled form elements | 11; 1; 2 |
| Mission Board | unlabeled form elements | 2 |

Each view also reported **3 incomplete axe rules** requiring further review.
All **4/4 keyboard smoke checks passed**. Seven total violation-rule entries
were detected across three views; these represent rule findings, not necessarily
seven distinct elements or user-impact incidents.

## Changes

- \`src/main.jsx\`: use the actual visible repository-desk text as the button's
  accessible name instead of an \`aria-label\` that hid part of the visible button
  content. Keep a screen-reader-only “Inspect repository” instruction.
- \`src/main.jsx\`: give both visually hidden file input controls meaningful
  programmatic labels.
- \`src/living.css\`: increase all twelve mini-map station targets from 11–13px to
  **28px**, even at the narrower breakpoint. Add an obvious keyboard focus ring;
  remove zoom-on-focus that could obscure neighboring controls.
- \`src/office.css\`: brighten nested inspector secondary text and definition-list
  terms for better contrast on dark backgrounds.
- \`scripts/r14_a11y_contract.mjs\`: add bounded **CSS class token hints** and
  incomplete axe rule IDs to future receipts. The collector **does not** store
  full selector strings, DOM HTML, text node values, input values, screenshots
  or user secrets. The only exported hints are static CSS class tokens.
- \`tests/r15-a11y-fixes.test.mjs\`: checks labels, button accessible names,
  28px minimap targets, brighter inspector secondary text, bounded class-only
  diagnostics, and preserved fail-closed semantics.

## Validation and next step

Normal PR CI tests the code and builds the site; **it does not prove the
published site passes the accessibility audit**. After the fix is reviewed,
merged and successfully deployed, manually run the existing
\`PhiMada R14 Live Accessibility Audit (Manual)\` workflow with the **new
current main SHA** and confirmation \`RUN_PHI_MADA_A11Y_AUDIT\`.

Read the new \`phimada-r14-accessibility-<run_id>\` artifact whether the
job is green or red. Remaining contrast failures or incomplete axe rules
will now have bounded rule/class hints so the next repair can target exact
components instead of guessing. Do not suppress findings or treat an
automated scan as WCAG certification. Screen-reader testing and human
accessibility acceptance are still required.

No automatic workflow dispatch, no consent bypass, no merge authorization,
no contract-completion ticks or product certification.
