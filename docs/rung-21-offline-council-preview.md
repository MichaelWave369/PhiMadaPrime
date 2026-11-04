# PhiMada R21: Isolated production-build Chromium Council acceptance

## Problem

R18 introduced a visible Research Council E1 viewer in the Mission Board; R19 added a *manually invoked* live GitHub Pages browser test; R20 added an independent artifact reviewer. We still need an **automatic real browser test during PR review** that does not touch production or circumvent the operator authorization required by R19.

R21 introduces a separate **read-only, isolated, automatic Chromium preview gate**. It runs the actual compiled Vite build at `http://127.0.0.1:4173/` inside a GitHub-hosted CI runner. The built source marker is compared with GitHub Actions' exact checked-out commit SHA, which may be the ephemeral PR merge ref in a pull request. This is **not** a claim of the PR head, public `main`, or deployed Pages version.

## What the browser really does

The dedicated `R21 Isolated Chromium Council Preview` workflow automatically runs on relevant PR changes and pushes to `main`:

1. Check out the CI candidate with no persisted GitHub credentials.
2. Install Node 22 and pinned frontend packages with lifecycle scripts disabled.
3. Run static safety tests.
4. Build the actual React website, embedding the CI checkout commit marker.
5. Install Chromium, then launch `vite preview` on **127.0.0.1 port 4173**, not 0.0.0.0 or a public deployment.
6. Open Chromium. Route all browser-initiated off-origin requests to `abort()`; deny all non-GET/HEAD methods, even toward the local server. This deliberately forces the site to exercise its labeled example/fallback catalog mode and avoids leaking the local synthetic fixture through a request.
7. Use the real visible Mission Board → Evidence Bay → Council disclosure and a browser file picker to import the **producer-generated** public synthetic E1-D golden JSON.
8. Exercise each of nine checks and emit one bounded JSON receipt. An incomplete or failed interaction makes the job red.

The nine checks are: preview HTTP/build marker, navigation/disclosure, valid E1 import, tampered hash refusal, rehashed execution-authority refusal, self-consistent forged-source still held, Clear, reload state reset, and no unsafe browser HTTP methods.

## Meaning of green

Green **establishes that the compiled source passed these browser UI interactions against a local candidate preview at the observed CI build marker**. It does not establish that GitHub Pages is deployed or working, that public GitHub data loaded, that R19 ran, that a Council source is authenticated, that a model executed, or that software is complete. The fixture is `SIMULATED`/`PUBLIC_SYNTHETIC`, not a physical measurement or scientific result.

R21 checks only these bounded interactions, not every accessibility or mobile/Quest browser journey. R14 axe, R19 live Pages check, and R20 actual GitHub Actions ZIP review are distinct and remain necessary for their own claims.

The preview may count blocked public catalog GETs as expected isolation; it must **never** count non-GET/HEAD requests as acceptable. It never authenticates imported source SHAs or grants Agentora / PhiKernel / PhiMada a job, verification or merge permission.

## Review steps

Use the GitHub PR status, `R21 Isolated Chromium Council Preview` run, and its downloadable bounded artifact `phimada-r21-local-preview-<run-id>` containing `council-preview.json`.

```sh
npm test
node --check scripts/r21_preview_council_browser.mjs
npm run build
```

`npm test` confirms source and policy contracts; the dedicated R21 workflow runs the actual browser using Chromium. Do not promote the static tests into claims of browser observation. R21 requires no privileged token and uploads no full DOM or private user data.

**After this gate is green and merged, the next non-negotiable live acceptance remains R19**, which only a person can authorize by entering a current `main` SHA and the exact typed phrase `RUN_PHI_MADA_COUNCIL_BROWSER`. R20 can then independently review the original R19 ZIP.

**Capability ≠ authority. Preview ≠ deployment. Software compatibility ≠ experimental confirmation.**
