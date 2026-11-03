// PhiMada Prime R10: locally correlate an Agentora R0.7 review and the
// original R0.6 ZIP with GitHub's live, public Actions metadata.
// No upload, token, writes, executable worker, merge or completion authority.
// A review JSON alone is not authentic: independent R0.7 CLI is still required.
import { OWNER } from "./fleet.mjs";

export const EVIDENCE_REVIEW_SCHEMA = "agentora.fleet.pilot-evidence-review.v0.7";
export const EVIDENCE_MAX_REVIEW_BYTES = 65536;
export const EVIDENCE_MAX_ZIP_BYTES = 2_000_000;
const MAX_API_BYTES = 350000;
const MAX_ARTIFACTS = 100;
const AGENTORA_REPO_ID = 1167870912;
const PHIMADA_REPO_ID = 1443845098;
const AGENTORA_NAME = OWNER + "/Agentora";
const PILOT_NAME = OWNER + "/PhiMadaPrime";
const WORKFLOW_PATH = ".github/workflows/fleet-r06-phimada-pilot.yml";
const HEX40 = /^[a-f0-9]{40}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const MAX_REPORT_AGE_MS = 8 * 24 * 3600000;
const EXPECTED_CHECKS = ["dependency_install", "node_tests", "vite_build"];

function assert(ok, code) {
  if (!ok) throw new Error(code);
}
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function dateValue(value) {
  return typeof value === "string" ? Date.parse(value) : NaN;
}
function safeDate(value, now) {
  const instant = dateValue(value);
  assert(Number.isFinite(instant) && instant <= now + 300000 &&
    instant >= now - MAX_REPORT_AGE_MS, "EVIDENCE_DATE_INVALID_OR_EXPIRED");
  return instant;
}
function catalogAccepts(rows) {
  return Array.isArray(rows) && rows.some(r => r && !r.exampleOnly &&
    r.id === PHIMADA_REPO_ID && r.full_name === PILOT_NAME &&
    r.archived !== true);
}
function authorityIsOff(value) {
  const fields = ["signed_attestation", "independent_reproduction_performed",
    "current_pilot_head_rechecked", "runtime_browser_verified",
    "product_verified", "verified_complete", "dispatch_authorized",
    "merge_authorized"];
  return fields.every(k => value[k] === false);
}
function checkLabels(value) {
  return object(value) && EXPECTED_CHECKS.every(name =>
    value[name] === "EXIT_0_REPORTED_BY_PILOT") &&
    Object.keys(value).length === EXPECTED_CHECKS.length;
}

export function parseEvidenceReview(raw, catalog, now = Date.now()) {
  assert(typeof raw === "string" &&
    new TextEncoder().encode(raw).length <= EVIDENCE_MAX_REVIEW_BYTES,
    "EVIDENCE_REVIEW_FILE_TOO_LARGE");
  assert(catalogAccepts(catalog), "EVIDENCE_LIVE_PUBLIC_CATALOG_REQUIRED");
  let report;
  try { report = JSON.parse(raw); }
  catch { throw new Error("EVIDENCE_JSON_INVALID"); }
  assert(object(report) && report.schema === EVIDENCE_REVIEW_SCHEMA &&
    report.state === "GITHUB_PILOT_ARTIFACT_DIGEST_CORRELATED" &&
    report.source === "GITHUB_ACTIONS_REST_AND_SHA256_ARCHIVE" &&
    report.scope === "ONE_MANUALLY_TRIGGERED_PHI_MADA_SHA_ONLY" &&
    authorityIsOff(report) && report.operator_review_required === true &&
    report.artifact_integrity_correlated === true &&
    report.workflow_success_observed === true &&
    report.pilot_repository === PILOT_NAME &&
    report.pilot_repository_id === PHIMADA_REPO_ID &&
    HEX40.test(report.pilot_source_sha || "") &&
    checkLabels(report.observed_fixed_checks),
    "EVIDENCE_REVIEW_UNTRUSTED_OR_UNSUPPORTED");
  const run = report.github_workflow_run, artifact = report.artifact;
  assert(object(run) && object(artifact) && Number.isSafeInteger(run.run_id) &&
    run.run_id > 0 && run.run_attempt === 1 &&
    run.repository === AGENTORA_NAME &&
    run.event === "workflow_dispatch" &&
    run.workflow_path === WORKFLOW_PATH &&
    HEX40.test(run.agentora_head_sha || "") &&
    run.url === "https://github.com/" + AGENTORA_NAME +
      "/actions/runs/" + run.run_id &&
    Number.isSafeInteger(artifact.id) && artifact.id > 0 &&
    artifact.name === "fleet-r06-phimada-" + run.run_id &&
    HEX64.test(artifact.sha256 || "") &&
    artifact.github_digest_matched === true &&
    Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0 &&
    artifact.bytes <= EVIDENCE_MAX_ZIP_BYTES,
    "EVIDENCE_PROVENANCE_INVALID");
  const reviewed = safeDate(report.reviewed_utc, now);
  const pre = safeDate(report.preflight_observed_utc, now);
  const post = safeDate(report.postflight_observed_utc, now);
  assert(pre <= post && post <= reviewed + 300000,
    "EVIDENCE_TIMELINE_INVALID");
  return {
    runId: run.run_id, artifactId: artifact.id,
    artifactBytes: artifact.bytes, artifactSha256: artifact.sha256,
    sourceSha: report.pilot_source_sha, agentoraSha: run.agentora_head_sha,
    reviewedUtc: report.reviewed_utc,
    preflightUtc: report.preflight_observed_utc,
    postflightUtc: report.postflight_observed_utc,
    runUrl: "https://github.com/" + AGENTORA_NAME +
      "/actions/runs/" + run.run_id,
    status: "LOCAL_R07_REPORT_NOT_YET_CORROBORATED",
    productVerified: false, mergeAuthorized: false
  };
}

export async function digestEvidenceZip(zip, cryptoApi = globalThis.crypto) {
  assert(zip && typeof zip.arrayBuffer === "function" &&
    Number.isSafeInteger(zip.size) && zip.size > 0 &&
    zip.size <= EVIDENCE_MAX_ZIP_BYTES, "EVIDENCE_ZIP_TOO_LARGE_OR_MISSING");
  assert(typeof cryptoApi?.subtle?.digest === "function",
    "EVIDENCE_CRYPTO_UNAVAILABLE");
  const contents = await zip.arrayBuffer();
  assert(contents.byteLength === zip.size && contents.byteLength <= EVIDENCE_MAX_ZIP_BYTES,
    "EVIDENCE_ZIP_SIZE_CHANGED");
  const hash = await cryptoApi.subtle.digest("SHA-256", contents);
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
}

async function getPublicJson(fetcher, path) {
  // URLs are always constructed from fixed repository paths and a validated integer.
  const response = await fetcher("https://api.github.com" + path, {
    method: "GET", credentials: "omit", redirect: "error", cache: "no-store",
    headers: { Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28" }
  });
  assert(response?.ok, "EVIDENCE_GITHUB_READ_UNAVAILABLE");
  const claimed = Number(response.headers?.get?.("content-length"));
  assert(!Number.isFinite(claimed) || claimed <= MAX_API_BYTES,
    "EVIDENCE_GITHUB_RESPONSE_TOO_LARGE");
  const raw = await response.text();
  assert(typeof raw === "string" && raw.length <= MAX_API_BYTES,
    "EVIDENCE_GITHUB_RESPONSE_TOO_LARGE");
  try { return JSON.parse(raw); }
  catch { throw new Error("EVIDENCE_GITHUB_JSON_INVALID"); }
}

function validSourceHead(branch) {
  return object(branch) && branch.name === "main" &&
    object(branch.commit) && HEX40.test(branch.commit.sha || "");
}

export async function corroborateEvidence(review, zip, catalog,
  { fetcher = globalThis.fetch, cryptoApi = globalThis.crypto,
    now = Date.now() } = {}) {
  assert(object(review) && Number.isSafeInteger(review.runId) &&
    review.runId > 0 && HEX64.test(review.artifactSha256 || "") &&
    HEX40.test(review.sourceSha || "") &&
    HEX40.test(review.agentoraSha || "") &&
    catalogAccepts(catalog), "EVIDENCE_REVIEW_NOT_READY");
  const digest = await digestEvidenceZip(zip, cryptoApi);
  assert(zip.size === review.artifactBytes && digest === review.artifactSha256,
    "EVIDENCE_LOCAL_ARCHIVE_MISMATCH");
  const base = "/repos/" + AGENTORA_NAME + "/actions/runs/" + review.runId;
  const [run, collection, pilot] = await Promise.all([
    getPublicJson(fetcher, base),
    getPublicJson(fetcher, base + "/artifacts?per_page=100"),
    getPublicJson(fetcher, "/repos/" + PILOT_NAME)
  ]);
  assert(object(run) && run.id === review.runId &&
    run.event === "workflow_dispatch" && run.path === WORKFLOW_PATH &&
    run.status === "completed" && run.conclusion === "success" &&
    run.run_attempt === 1 && run.head_sha === review.agentoraSha &&
    object(run.repository) && run.repository.id === AGENTORA_REPO_ID &&
    run.repository.full_name === AGENTORA_NAME &&
    object(run.head_repository) &&
    run.head_repository.full_name === AGENTORA_NAME,
    "EVIDENCE_GITHUB_RUN_MISMATCH");
  const runCreated = safeDate(run.created_at, now);
  assert(runCreated <= dateValue(review.reviewedUtc) + 300000,
    "EVIDENCE_RUN_REVIEW_TIMELINE_INVALID");
  assert(object(collection) && Number.isSafeInteger(collection.total_count) &&
    collection.total_count >= 1 && collection.total_count <= MAX_ARTIFACTS &&
    Array.isArray(collection.artifacts) &&
    collection.artifacts.length === collection.total_count,
    "EVIDENCE_GITHUB_ARTIFACT_LIST_INCOMPLETE");
  const match = collection.artifacts.filter(a => object(a) &&
    a.name === "fleet-r06-phimada-" + review.runId);
  assert(match.length === 1 && match[0].id === review.artifactId &&
    match[0].expired === false &&
    match[0].size_in_bytes === zip.size &&
    match[0].digest === "sha256:" + digest &&
    (!object(match[0].workflow_run) ||
      match[0].workflow_run.id === review.runId),
    "EVIDENCE_GITHUB_ARTIFACT_MISMATCH");
  assert(object(pilot) && pilot.id === PHIMADA_REPO_ID &&
    pilot.full_name === PILOT_NAME &&
    object(pilot.owner) && pilot.owner.login === OWNER &&
    pilot.private === false && pilot.archived === false &&
    pilot.default_branch === "main",
    "EVIDENCE_PUBLIC_REPOSITORY_MISMATCH");
  const headPath = "/repos/" + PILOT_NAME + "/branches/main";
  const first = await getPublicJson(fetcher, headPath);
  const second = await getPublicJson(fetcher, headPath);
  assert(validSourceHead(first) && validSourceHead(second),
    "EVIDENCE_GITHUB_HEAD_INVALID");
  const firstSha = first.commit.sha, secondSha = second.commit.sha;
  const movedDuringRead = firstSha !== secondSha;
  const movedSincePilot = secondSha !== review.sourceSha;
  const state = movedDuringRead ? "HEAD_CHANGED_DURING_OBSERVATION" :
    movedSincePilot ? "HISTORICAL_SHA_SOURCE_HAS_MOVED" :
    "GITHUB_ARTIFACT_AND_SOURCE_METADATA_CORRELATED";
  return {
    ...review, status: state, currentHeadSha: secondSha,
    observedAt: new Date(now).toISOString(),
    archiveDigestMatched: true, githubRunMatched: true,
    githubArtifactMatched: true, currentShaMatched: !movedSincePilot && !movedDuringRead,
    apiRequests: 5,
    productVerified: false, mergeAuthorized: false,
    completionVerified: false, independentlyReplayed: false
  };
}
