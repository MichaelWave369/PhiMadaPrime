# Φ Verified Pipeline Factory R43 · GMED public second opinion

R43 extends R42's **locally imported, unsigned GMED receipt** with an
operator-triggered, independent-implementation **second observation** of
public GitHub data. The provider remains the same GitHub public REST API.

## Operator workflow

1. Open ThinkTank → Pipeline Factory → GMED × WITNESS receipt desk.
2. Select an original GMED `gmed-report:v1` JSON file.
3. Inspect its reported PR, merge SHA, counts and observation time.
4. Choose **Recheck public GitHub now** to request live API evidence.
5. Compare the fresh classification, public merge commit and exact signal
   rows with the imported file. A WITNESS snapshot is optional and remains
   an independent local checksum-only view.

Importing the JSON **does not** make any network requests. The recheck
button is the only new GitHub request trigger. The importer rejects
unknown fields, forged authority, inconsistent rows or malformed IDs
before it permits public re-observation. Only MichaelWave369 public
repositories are queried. Credentials are omitted from all HTTP GETs.

## What R43 checks

- The observed public repository is public and its full name matches
  the imported target.
- The public pull request has the requested number and belongs to that
  repository.
- The merge flag and exact merge SHA agree with the imported report.
- The complete sampled check-run and legacy-status pages were retrieved
  within bounded limits (five pages each, up to 500 rows each); changing
  total-count metadata, truncated results and API errors fail closed.
- A fresh classifier independently grades checks/statuses. No failures,
  pending, unknown or success-free outcomes can be called GMED-green.
- The multiset of each normalized row (kind, name, status, conclusion,
  grade, report URL) matches the imported receipt, regardless of row order.
- A 15-minute-old or older imported receipt can still be compared but
  is explicitly marked **stale** as a historical source observation.

### Result states

- `SECOND_OBSERVATION_GMED_AGREEMENT`: GitHub's new observation agrees
  with every compared item in the imported GMED-green report.
- `SECOND_OBSERVATION_NON_GREEN_AGREEMENT`: both sources agree the PR is
  not GMED-green (such as not merged, pending or failed).
- `SECOND_OBSERVATION_MISMATCH`: imported report differs from fresh GitHub
  PR state, merge SHA or exact signal multiset.
- `REOBSERVATION_UNAVAILABLE`: network, API completeness, validation or
  rate-limit issue prevents a defensible comparison.
- `TARGET_OUTSIDE_PUBLIC_FLEET`: the imported report does not belong to
  the selected public owner.

## Strong limitations

A successful comparison is **not** a cryptographic authentication of
the original GMED report, a separate trust provider, proof of every
repository-required status check, execution of test commands, confirmation
of production functionality, a signed build attestation, original WITNESS
source replay, or a grant to merge/deploy. GitHub observations can change
between the two timestamps, including on the merge SHA. No automation,
repository writes, model inference, background polling or independent
organizational audit is added.

Both results explicitly keep permissions empty, merge authorization
false and tests-replayed false. No synthetic R40 fixture can enter
the real GMED parser. GMED Ouroboros itself remains a separate project;
R43 independently implements the re-observation concept in PhiMadaPrime
without claiming a different underlying evidence provider.

## Acceptance

Run `npm test && npm run build`. The 21 new Node regressions use only
mocked GitHub HTTP responses: no live network calls. Test same/different
merge SHAs, forged check rows, pending/failing statuses, stale imports,
private and wrong owner, truncated/changing pagination, API 403,
and non-green agreement. Then manually check the live button, loading
state and changed-import cancellation in a deployed browser.
