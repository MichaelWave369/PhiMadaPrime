// R12 immutable-source browser smoke contract. Nothing here authorizes PR merges.
export const BROWSER_SCHEMA = "phimada.live-browser-smoke.v0.12";
export const BROWSER_SITE = "https://michaelwave369.github.io/PhiMadaPrime/";
export const BROWSER_REPO = "MichaelWave369/PhiMadaPrime";
export const BROWSER_REPO_ID = 1443845098;
export const BROWSER_CONFIRM = "RUN_PHI_MADA_BROWSER_SMOKE";
export const BROWSER_CHECKS = Object.freeze([
  "page_boot", "public_catalog", "search_repo", "inspect_desk",
  "close_inspector", "open_mission_board", "evidence_bay_controls",
  "return_to_desks"
]);
const HEX40 = /^[0-9a-f]{40}$/;

function requireCondition(ok, reason) {
  if (!ok) throw new Error(reason);
}
export function requireManualBrowserPilot(sha, confirmation) {
  requireCondition(typeof sha === "string" && HEX40.test(sha),
    "EXACT_SOURCE_SHA_REQUIRED");
  requireCondition(confirmation === BROWSER_CONFIRM,
    "EXPLICIT_OPERATOR_CONFIRMATION_REQUIRED");
  return sha;
}
export function validateGithubSource(repo, heads, sha) {
  requireCondition(typeof sha === "string" && HEX40.test(sha),
    "EXACT_SOURCE_SHA_REQUIRED");
  requireCondition(repo && typeof repo === "object" &&
    !Array.isArray(repo) && repo.id === BROWSER_REPO_ID &&
    repo.full_name === BROWSER_REPO &&
    repo.owner?.login === "MichaelWave369" &&
    repo.private === false && repo.archived === false &&
    repo.default_branch === "main",
    "GITHUB_REPOSITORY_IDENTITY_CHANGED");
  requireCondition(Array.isArray(heads) && heads.length === 2 &&
    heads.every(h => h && h.name === "main" &&
      typeof h.commit?.sha === "string" && HEX40.test(h.commit.sha)),
    "GITHUB_HEAD_RESPONSE_INVALID");
  requireCondition(heads[0].commit.sha === heads[1].commit.sha,
    "GITHUB_HEAD_CHANGED_DURING_OBSERVATION");
  requireCondition(heads[1].commit.sha === sha,
    "GITHUB_HEAD_DIFFERS_FROM_REQUESTED_SHA");
  return heads[1].commit.sha;
}

export function browserSmokeReceipt({
  expectedSha, beforeSha, afterSha, builtSha,
  checks = {}, errors = [], runId = null, observedUtc
}) {
  requireCondition(typeof expectedSha === "string" && HEX40.test(expectedSha),
    "EXACT_SOURCE_SHA_REQUIRED");
  requireCondition(typeof observedUtc === "string" &&
    Number.isFinite(Date.parse(observedUtc)), "OBSERVATION_TIME_INVALID");
  requireCondition(runId === null || typeof runId === "string" &&
    /^[0-9]{1,20}$/.test(runId), "RUN_ID_INVALID");
  requireCondition(Array.isArray(errors) && errors.length <= 20 &&
    errors.every(e => typeof e === "string" && e.length <= 300),
    "BROWSER_ERRORS_INVALID");
  requireCondition(checks && typeof checks === "object" &&
    !Array.isArray(checks) && Object.keys(checks).every(k => BROWSER_CHECKS.includes(k)) &&
    Object.values(checks).every(x => x === "PASS" || x === "FAIL" || x === "NOT_RUN"),
    "CHECK_RECORD_INVALID");
  const recorded = Object.fromEntries(BROWSER_CHECKS.map(k =>
    [k, checks[k] || "NOT_RUN"]));
  const sourceStable = beforeSha === expectedSha && afterSha === expectedSha;
  const deployedRevisionMatch = builtSha === expectedSha;
  const allStepsPassed = BROWSER_CHECKS.every(k => recorded[k] === "PASS");
  const passed = sourceStable && deployedRevisionMatch && allStepsPassed && errors.length === 0;
  const state = !sourceStable ? "HELD_PUBLIC_HEAD_NOT_STABLE" :
    !deployedRevisionMatch ? "HELD_DEPLOYED_REVISION_MARKER_MISMATCH" :
    !allStepsPassed ? "FAILED_OR_INCOMPLETE_BROWSER_INTERACTIONS" :
    errors.length ? "FAILED_BROWSER_RUNTIME_ERRORS" :
    "AUTOMATED_BROWSER_SMOKE_PASSED_AT_OBSERVED_SHA";
  return {
    schema: BROWSER_SCHEMA, state, repository: BROWSER_REPO,
    repository_id: BROWSER_REPO_ID, target_url: BROWSER_SITE,
    source_sha: expectedSha, github_head_before_sha: beforeSha || null,
    github_head_after_sha: afterSha || null,
    observed_deployment_build_marker: builtSha || null,
    deployed_marker_matches_requested_sha: deployedRevisionMatch,
    marker_is_signed_deployment_attestation: false,
    observed_utc: observedUtc, workflow_run_id: runId,
    checks: recorded, browser_runtime_errors: errors,
    automated_browser_smoke_passed: passed,
    keyboard_accessibility_audited: false,
    full_accessibility_reviewed: false,
    complete_user_journeys_verified: false,
    deployed_revision_cryptographically_verified: false,
    product_verified: false, verified_complete: false,
    merge_authorized: false, job_dispatch_authorized: false,
    operator_review_required: true
  };
}
