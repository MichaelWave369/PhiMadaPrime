# Φ Verified Pipeline Factory · R44: Required-check policy inspection

R44 is a separate, operator-triggered check after R43's public GMED second
opinion, not a new verifier for R40's synthetic receipts.

## GitHub policy inputs

1. GET /repos/{owner}/{repo}/rules/branches/{branch}
2. GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks

These are **different** GitHub APIs. Active rulesets are readable on public
repositories; classic protection may return 403 or 404. Either response
is UNKNOWN coverage, not proof that the branch has no required checks.

## Operator workflow

Open ThinkTank → Pipeline Factory → GMED × WITNESS desk. Import an original
GMED v1 report and choose **Recheck public GitHub now**. If R43 shows
SECOND_OBSERVATION_GMED_AGREEMENT, select **Inspect required-check policy**.
Importing a file alone never fetches policy. Only that button starts reads.

R44 requires a fresh matching R43 re-observation of the same PR, merged SHA,
and a base-branch name observed at GitHub. It uses anonymous public GitHub
GETs with credentials omitted and redirects forbidden. The reader limits
rules to 300 records across three pages, required contexts to 100, and
each request to 15 seconds. Missing/incomplete pagination fails closed.

## What it compares

The policy inventory compares declared status names with exact-name check
runs or legacy commit statuses observed at the **merged commit** by R43.
Skipped, neutral, missing, failed, pending, or ambiguous duplicate rows
cannot satisfy a required success. App-specific integration_id / app_id
constraints remain unverified: GMED's normalized rows don't authenticate
the status creator. Additional merge gates (approvals, workflows, scanning,
signatures, deployments, unknown rules) remain explicitly unevaluated.

## Result states

- DECLARED_CONTEXTS_OBSERVED_SUCCESS: all declared names have observed
  success, both policy endpoints were read and no other active rule types
  appeared. Still NOT a merge grant, complete policy proof or test replay.
- REQUIRED_CONTEXTS_NOT_SUCCESSFUL: a required name is missing, failed,
  skipped, pending or ambiguous.
- POLICY_COVERAGE_INCOMPLETE: classic policy 403/404. Visible ruleset
  requirements remain useful but incomplete.
- APP_SOURCE_UNVERIFIED: a required app identity could not be proven.
- OTHER_MERGE_GATES_NOT_EVALUATED: further active branch rules apply.
- NO_REQUIRED_CONTEXTS_DISCLOSED: no required status names were exposed.
  This does NOT establish that no merge constraints exist.
- POLICY_OBSERVATION_UNAVAILABLE: malformed/denied/rate-limited/incomplete
  public ruleset inspection.
- FRESH_GMED_REOBSERVATION_REQUIRED: R43 second opinion missing, stale,
  mismatched or invalid. This path makes zero policy HTTP requests.

## Trust boundary

Current public branch configuration may differ from the policy that applied
when a historical PR merged. Merge-SHA status names do not prove the
pre-merge tree, branch protection enforcement, test commands, provenance
or runtime behavior. Every report keeps all_required_checks_verified=false,
issuer_signature_verified=false, test_commands_replayed=false,
merge_authorized=false, deployment_authorized=false and permissions=[].

## Validation

Run npm test and npm run build, plus Chromium preview checks. R44 regression
fixtures simulate missing required check names, failing and skipped runs,
unavailable classic protection, malformed and paginated rulesets, app-ID
restrictions, future rule types and stale/forged R43 observations.
Manually test the public endpoint behavior in the deployed browser.
No persistent tokens, write APIs, automated merge, agent or execution added.

Signed provenance is a separate future rung requiring explicit pinned issuer
keys and signed payload contracts, not a self-checksummed local file.
