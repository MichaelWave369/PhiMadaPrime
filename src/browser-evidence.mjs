// PhiMada R13: local read-only UI correlation of reviewed browser ZIP,
// GitHub Actions artifact metadata and current public main HEAD.
// This browser does NOT parse ZIP internals or authenticate imported JSON.
import { digestEvidenceZip } from "./evidence-bay.mjs";

export const R13_REVIEW_SCHEMA = "phimada.browser-evidence-review.v0.13";
export const R13_REVIEW_BYTES = 65536;
const OWNER = "MichaelWave369";
const REPO = OWNER + "/PhiMadaPrime";
const REPO_ID = 1443845098;
const PATH = ".github/workflows/r12-browser-smoke.yml";
const HEX40 = /^[a-f0-9]{40}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const AGE_MS = 7 * 24 * 3600000;
const CHECKS = Object.freeze([
  "page_boot", "public_catalog", "search_repo", "inspect_desk",
  "close_inspector", "open_mission_board", "evidence_bay_controls",
  "return_to_desks"
]);
function ensure(value, code) {
  if (!value) throw new Error(code);
}
function obj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function dateOk(value, now) {
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(ms) && ms <= now + 300000 && now - ms <= AGE_MS;
}
function liveCatalog(catalog) {
  return Array.isArray(catalog) && catalog.some(repo =>
    repo && !repo.exampleOnly && repo.id === REPO_ID &&
    repo.full_name === REPO && repo.archived !== true);
}
function flagsOff(x) {
  return ["independently_replayed", "complete_user_journeys_verified",
    "accessibility_verified", "deployment_cryptographically_attested",
    "product_verified", "verified_complete",
    "merge_authorized", "dispatch_authorized"].every(k => x[k] === false);
}
export function parseBrowserReview(raw, catalog, now = Date.now()) {
  ensure(typeof raw === "string" &&
    new TextEncoder().encode(raw).length <= R13_REVIEW_BYTES,
    "R13_REVIEW_FILE_TOO_LARGE");
  ensure(liveCatalog(catalog), "R13_PUBLIC_CATALOG_REQUIRED");
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("R13_JSON_INVALID"); }
  ensure(obj(data) && data.schema === R13_REVIEW_SCHEMA &&
    ["BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA",
     "BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA"].includes(data.state) &&
    data.source === "GITHUB_ACTIONS_RUN_AND_ARTIFACT_SHA256" &&
    data.repository === REPO && data.repository_id === REPO_ID &&
    data.workflow_path === PATH && data.workflow_attempt === 1 &&
    Number.isSafeInteger(data.workflow_run_id) && data.workflow_run_id > 0 &&
    Number.isSafeInteger(data.artifact_id) && data.artifact_id > 0 &&
    data.artifact_name === "phimada-r12-browser-" + data.workflow_run_id &&
    Number.isSafeInteger(data.artifact_bytes) &&
    data.artifact_bytes > 0 && data.artifact_bytes <= 2_000_000 &&
    HEX64.test(data.artifact_sha256 || "") &&
    HEX40.test(data.workflow_source_sha || "") &&
    data.workflow_source_sha === data.browser_source_sha &&
    HEX40.test(data.current_observed_head_sha || "") &&
    data.current_head_matches_browser_source ===
      (data.current_observed_head_sha === data.browser_source_sha) &&
    data.state === (data.current_head_matches_browser_source ?
      "BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA" :
      "BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA") &&
    data.artifact_digest_correlated === true &&
    data.artifact_zip_contents_validated === true &&
    data.browser_check_count === CHECKS.length &&
    obj(data.reported_browser_checks) &&
    Object.keys(data.reported_browser_checks).length === CHECKS.length &&
    CHECKS.every(k => data.reported_browser_checks[k] === "PASS") &&
    flagsOff(data) && data.operator_review_required === true &&
    dateOk(data.reviewed_utc, now) && dateOk(data.browser_observed_utc, now) &&
    Date.parse(data.browser_observed_utc) <=
      Date.parse(data.reviewed_utc) + 300000,
    "R13_REPORT_INVALID_OR_UNTRUSTED");
  return {
    runId: data.workflow_run_id, artifactId: data.artifact_id,
    artifactBytes: data.artifact_bytes, artifactSha256: data.artifact_sha256,
    sha: data.browser_source_sha, reviewerUtc: data.reviewed_utc,
    browserObservedUtc: data.browser_observed_utc,
    runUrl: "https://github.com/" + REPO +
      "/actions/runs/" + data.workflow_run_id,
    status: "LOCAL_R13_REPORT_UNCORROBORATED",
    browserCheckCount: CHECKS.length,
    productVerified: false, mergeAuthorized: false
  };
}

async function githubJson(fetcher, path) {
  const r = await fetcher("https://api.github.com" + path, {
    method: "GET", credentials: "omit", redirect: "error", cache: "no-store",
    headers: { Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28" }
  });
  ensure(r?.ok, "R13_GITHUB_READ_FAILED");
  const length = Number(r.headers?.get?.("content-length"));
  ensure(!Number.isFinite(length) || length <= 250000,
    "R13_GITHUB_RESPONSE_TOO_LARGE");
  const raw = await r.text();
  ensure(typeof raw === "string" && raw.length <= 250000,
    "R13_GITHUB_RESPONSE_TOO_LARGE");
  try { return JSON.parse(raw); } catch { throw new Error("R13_GITHUB_JSON_INVALID"); }
}
function branchSha(head) {
  ensure(obj(head) && head.name === "main" &&
    obj(head.commit) && HEX40.test(head.commit.sha || ""),
    "R13_GITHUB_HEAD_INVALID");
  return head.commit.sha;
}
export async function corroborateBrowserReview(review, zip, catalog,
  {fetcher = globalThis.fetch, cryptoApi = globalThis.crypto,
   now = Date.now()} = {}) {
  ensure(obj(review) && liveCatalog(catalog) &&
    Number.isSafeInteger(review.runId) && review.runId > 0 &&
    HEX40.test(review.sha || "") &&
    HEX64.test(review.artifactSha256 || "") &&
    dateOk(review.reviewerUtc, now), "R13_REPORT_NOT_READY");
  const digest = await digestEvidenceZip(zip, cryptoApi);
  ensure(digest === review.artifactSha256 &&
    zip.size === review.artifactBytes, "R13_LOCAL_ZIP_DIGEST_MISMATCH");
  const api = "/repos/" + REPO;
  const runBase = api + "/actions/runs/" + review.runId;
  const [run, artifacts, repository] = await Promise.all([
    githubJson(fetcher, runBase),
    githubJson(fetcher, runBase + "/artifacts?per_page=100"),
    githubJson(fetcher, api)
  ]);
  ensure(obj(run) && run.id === review.runId &&
    run.event === "workflow_dispatch" &&
    run.path === PATH &&
    run.status === "completed" && run.conclusion === "success" &&
    run.run_attempt === 1 && run.head_sha === review.sha &&
    obj(run.repository) && run.repository.id === REPO_ID &&
    run.repository.full_name === REPO &&
    obj(run.head_repository) && run.head_repository.full_name === REPO &&
    dateOk(run.created_at, now), "R13_GITHUB_RUN_MISMATCH");
  ensure(obj(artifacts) && Number.isSafeInteger(artifacts.total_count) &&
    artifacts.total_count >= 1 && artifacts.total_count <= 100 &&
    Array.isArray(artifacts.artifacts) &&
    artifacts.artifacts.length === artifacts.total_count,
    "R13_ARTIFACTS_INCOMPLETE");
  const matching = artifacts.artifacts.filter(a => obj(a) &&
    a.name === "phimada-r12-browser-" + review.runId);
  ensure(matching.length === 1 && matching[0].id === review.artifactId &&
    matching[0].expired === false &&
    matching[0].size_in_bytes === zip.size &&
    matching[0].digest === "sha256:" + digest &&
    (!obj(matching[0].workflow_run) ||
      matching[0].workflow_run.id === review.runId),
    "R13_GITHUB_ARTIFACT_MISMATCH");
  ensure(obj(repository) && repository.id === REPO_ID &&
    repository.full_name === REPO && obj(repository.owner) &&
    repository.owner.login === OWNER &&
    repository.private === false && repository.archived === false &&
    repository.default_branch === "main",
    "R13_GITHUB_REPOSITORY_MISMATCH");
  const first = branchSha(await githubJson(fetcher, api + "/branches/main"));
  const second = branchSha(await githubJson(fetcher, api + "/branches/main"));
  const stable = first === second, matches = stable && second === review.sha;
  return {
    ...review,
    status: !stable ? "R13_CURRENT_HEAD_CHANGED_DURING_READ" :
      matches ? "R13_BROWSER_ARTIFACT_CORRELATED_CURRENT_HEAD" :
      "R13_BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA",
    observedHeadSha: second,
    observedUtc: new Date(now).toISOString(),
    githubRunMatched: true, githubArtifactDigestMatched: true,
    browserSourceCurrent: matches,
    reportedBrowserSmokePassed: true,
    browserContentIndependentlyReplayed: false,
    reportCryptographicallySigned: false,
    accessibilityVerified: false,
    productVerified: false, mergeAuthorized: false,
    completionVerified: false
  };
}
