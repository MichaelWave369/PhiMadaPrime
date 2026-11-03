import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import {
  EVIDENCE_REVIEW_SCHEMA, EVIDENCE_MAX_REVIEW_BYTES, EVIDENCE_MAX_ZIP_BYTES,
  parseEvidenceReview, digestEvidenceZip, corroborateEvidence
} from "../src/evidence-bay.mjs";

const NOW = Date.parse("2026-11-03T18:00:00Z");
const AGENTORA_SHA = "a".repeat(40);
const SOURCE_SHA = "b".repeat(40);
const MOVED_SHA = "c".repeat(40);
const RUN = 41678177777;
const ARTIFACT_ID = 333777;
const ZIP_DATA = Buffer.from("Synthetic fixture data. Not a real artifact ZIP.");
const ZIP = new Blob([ZIP_DATA], { type: "application/zip" });
const SHA256 = createHash("sha256").update(ZIP_DATA).digest("hex");
const CATALOG = [{ id: 1443845098, name: "PhiMadaPrime",
  full_name: "MichaelWave369/PhiMadaPrime", archived: false, exampleOnly: false }];

function report(overrides = {}) {
  return {
    schema: EVIDENCE_REVIEW_SCHEMA,
    state: "GITHUB_PILOT_ARTIFACT_DIGEST_CORRELATED",
    reviewed_utc: "2026-11-03T17:15:00Z",
    source: "GITHUB_ACTIONS_REST_AND_SHA256_ARCHIVE",
    github_workflow_run: {
      repository: "MichaelWave369/Agentora",
      run_id: RUN,
      run_attempt: 1,
      event: "workflow_dispatch",
      workflow_path: ".github/workflows/fleet-r06-phimada-pilot.yml",
      agentora_head_sha: AGENTORA_SHA,
      url: "https://github.com/MichaelWave369/Agentora/actions/runs/" + RUN
    },
    artifact: {
      id: ARTIFACT_ID, name: "fleet-r06-phimada-" + RUN,
      sha256: SHA256, bytes: ZIP.size, github_digest_matched: true
    },
    pilot_repository: "MichaelWave369/PhiMadaPrime",
    pilot_repository_id: 1443845098,
    pilot_source_sha: SOURCE_SHA,
    preflight_observed_utc: "2026-11-03T16:40:00Z",
    postflight_observed_utc: "2026-11-03T16:49:00Z",
    observed_fixed_checks: {
      dependency_install: "EXIT_0_REPORTED_BY_PILOT",
      node_tests: "EXIT_0_REPORTED_BY_PILOT",
      vite_build: "EXIT_0_REPORTED_BY_PILOT"
    },
    scope: "ONE_MANUALLY_TRIGGERED_PHI_MADA_SHA_ONLY",
    artifact_integrity_correlated: true,
    workflow_success_observed: true,
    signed_attestation: false,
    independent_reproduction_performed: false,
    current_pilot_head_rechecked: false,
    runtime_browser_verified: false,
    product_verified: false,
    verified_complete: false,
    dispatch_authorized: false,
    merge_authorized: false,
    operator_review_required: true,
    ...overrides
  };
}
function parse(value = report(), rows = CATALOG, now = NOW) {
  return parseEvidenceReview(JSON.stringify(value), rows, now);
}

function githubData({ artifactDigest = SHA256, runEvent = "workflow_dispatch",
  runStatus = "completed", runConclusion = "success", archived = false,
  repoId = 1443845098, head = SOURCE_SHA, secondHead = head,
  runAttempt = 1 } = {}) {
  return {
    run: {
      id: RUN, event: runEvent,
      path: ".github/workflows/fleet-r06-phimada-pilot.yml",
      status: runStatus, conclusion: runConclusion, run_attempt: runAttempt,
      head_sha: AGENTORA_SHA, created_at: "2026-11-03T16:30:00Z",
      repository: { id: 1167870912, full_name: "MichaelWave369/Agentora" },
      head_repository: { full_name: "MichaelWave369/Agentora" }
    },
    artifacts: {
      total_count: 1, artifacts: [{
        id: ARTIFACT_ID, name: "fleet-r06-phimada-" + RUN,
        expired: false, size_in_bytes: ZIP.size,
        digest: "sha256:" + artifactDigest, workflow_run: { id: RUN }
      }]
    },
    repo: {
      id: repoId, full_name: "MichaelWave369/PhiMadaPrime",
      owner: { login: "MichaelWave369" }, private: false,
      archived, default_branch: "main"
    },
    head: { name: "main", commit: { sha: head } },
    second: { name: "main", commit: { sha: secondHead } }
  };
}
function fixtureFetcher(data, calls = []) {
  let headReads = 0;
  return async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.ok(url.startsWith("https://api.github.com/repos/MichaelWave369/"));
    const entry = url.includes("/actions/runs/") ?
      url.includes("/artifacts?per_page=100") ? data.artifacts : data.run :
      url.endsWith("/branches/main") ?
      (headReads++ ? data.second : data.head) : data.repo;
    return {
      ok: true, headers: { get: () => null },
      text: async () => JSON.stringify(entry)
    };
  };
}
async function corroborate(r = parse(), archive = ZIP, data = githubData(), calls = []) {
  return corroborateEvidence(r, archive, CATALOG, {
    fetcher: fixtureFetcher(data, calls),
    cryptoApi: webcrypto, now: NOW
  });
}

test("R0.7 review parses into bounded, untrusted local metadata", () => {
  const item = parse();
  assert.equal(item.status, "LOCAL_R07_REPORT_NOT_YET_CORROBORATED");
  assert.equal(item.runId, RUN);
  assert.equal(item.sourceSha, SOURCE_SHA);
  assert.equal(item.artifactSha256, SHA256);
  assert.equal(item.productVerified, false);
  assert.equal(item.mergeAuthorized, false);
});

test("no demonstration catalog entry can accept pilot evidence", () => {
  assert.throws(() => parse(report(), [{ ...CATALOG[0], id: -1,
    exampleOnly: true }]), /LIVE_PUBLIC_CATALOG_REQUIRED/);
  assert.throws(() => parse(report(), []), /LIVE_PUBLIC_CATALOG_REQUIRED/);
});

test("forged verification, approval, or signed attestation is rejected", () => {
  for (const key of ["product_verified", "verified_complete",
    "dispatch_authorized", "merge_authorized", "signed_attestation",
    "independent_reproduction_performed", "current_pilot_head_rechecked",
    "runtime_browser_verified"]) {
    assert.throws(() => parse(report({ [key]: true })),
      /UNTRUSTED_OR_UNSUPPORTED/, key);
  }
});

test("only R0.7 source and exact fixed check labels are accepted", () => {
  assert.throws(() => parse(report({ schema: "other" })), /UNTRUSTED/);
  assert.throws(() => parse(report({
    observed_fixed_checks: { dependency_install: "PASS", node_tests: "PASS",
      vite_build: "PASS" }
  })), /UNTRUSTED/);
  assert.throws(() => parse(report({ operator_review_required: false })), /UNTRUSTED/);
});

test("run origin and URL are derived, not accepted arbitrarily", () => {
  const x = report();
  x.github_workflow_run.url = "https://evil.example/redirect";
  assert.throws(() => parse(x), /PROVENANCE_INVALID/);
  x.github_workflow_run.url =
    "https://github.com/MichaelWave369/Agentora/actions/runs/" + RUN;
  x.github_workflow_run.run_attempt = 2;
  assert.throws(() => parse(x), /PROVENANCE_INVALID/);
});

test("artifact digest, sizes and run IDs must be valid", () => {
  for (const changed of [
    { sha256: "not-a-digest" }, { bytes: EVIDENCE_MAX_ZIP_BYTES + 1 },
    { bytes: 0 }, { id: -2 }, { github_digest_matched: false }
  ]) {
    const x = report();
    Object.assign(x.artifact, changed);
    assert.throws(() => parse(x), /PROVENANCE_INVALID/);
  }
});

test("stale, future and reversed review timestamps are refused", () => {
  assert.throws(() => parse(report(), CATALOG, NOW + 9 * 24 * 3600000),
    /DATE_INVALID_OR_EXPIRED/);
  assert.throws(() => parse(report({ reviewed_utc: "not-a-date" })),
    /DATE_INVALID_OR_EXPIRED/);
  assert.throws(() => parse(report({
    preflight_observed_utc: "2026-11-03T16:50:00Z",
    postflight_observed_utc: "2026-11-03T16:49:00Z"
  })), /TIMELINE_INVALID/);
});

test("malformed or oversized JSON rejected without further processing", () => {
  assert.throws(() => parseEvidenceReview("{", CATALOG, NOW), /JSON_INVALID/);
  assert.throws(() => parseEvidenceReview("x".repeat(EVIDENCE_MAX_REVIEW_BYTES + 1),
    CATALOG, NOW), /FILE_TOO_LARGE/);
});

test("local ZIP digest must match report before any GitHub call", async () => {
  const calls = [];
  await assert.rejects(() => corroborate(parse(), new Blob(["tampered"]), githubData(), calls),
    /LOCAL_ARCHIVE_MISMATCH/);
  assert.equal(calls.length, 0);
});

test("oversize or missing ZIP is rejected before fetching GitHub", async () => {
  const calls = [];
  const fake = { size: EVIDENCE_MAX_ZIP_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) };
  await assert.rejects(() => corroborate(parse(), fake, githubData(), calls),
    /ZIP_TOO_LARGE/);
  assert.equal(calls.length, 0);
});

test("original artifact bytes and live GitHub metadata are correlated", async () => {
  const calls = [];
  const result = await corroborate(parse(), ZIP, githubData(), calls);
  assert.equal(result.status, "GITHUB_ARTIFACT_AND_SOURCE_METADATA_CORRELATED");
  assert.equal(result.archiveDigestMatched, true);
  assert.equal(result.currentShaMatched, true);
  assert.equal(result.productVerified, false);
  assert.equal(result.mergeAuthorized, false);
  assert.equal(result.completionVerified, false);
  assert.equal(result.apiRequests, 5);
  assert.equal(calls.length, 5);
  assert.ok(!JSON.stringify(result).includes("RUN_PHI_MADA_TESTS"));
});

test("green run must be the right manual workflow and first attempt", async () => {
  for (const change of [
    { runEvent: "pull_request" }, { runStatus: "queued" },
    { runConclusion: "failure" }, { runAttempt: 2 }
  ]) {
    await assert.rejects(() => corroborate(parse(), ZIP, githubData(change)),
      /GITHUB_RUN_MISMATCH/);
  }
});

test("different GitHub archive digest does not elevate local review", async () => {
  await assert.rejects(() => corroborate(parse(), ZIP,
    githubData({ artifactDigest: "f".repeat(64) })),
  /GITHUB_ARTIFACT_MISMATCH/);
});

test("wrong, private-equivalent or archived repository identities are refused", async () => {
  for (const change of [{ repoId: 18 }, { archived: true }]) {
    await assert.rejects(() => corroborate(parse(), ZIP, githubData(change)),
      /PUBLIC_REPOSITORY_MISMATCH/);
  }
});

test("a historical SHA stays historical even if old checks passed", async () => {
  const result = await corroborate(parse(), ZIP,
    githubData({ head: MOVED_SHA }));
  assert.equal(result.status, "HISTORICAL_SHA_SOURCE_HAS_MOVED");
  assert.equal(result.currentShaMatched, false);
  assert.equal(result.currentHeadSha, MOVED_SHA);
  assert.equal(result.productVerified, false);
});

test("HEAD moving between API reads is separately flagged", async () => {
  const result = await corroborate(parse(), ZIP,
    githubData({ head: SOURCE_SHA, secondHead: MOVED_SHA }));
  assert.equal(result.status, "HEAD_CHANGED_DURING_OBSERVATION");
  assert.equal(result.currentShaMatched, false);
});

test("GitHub read failures cannot become evidence", async () => {
  await assert.rejects(() => corroborateEvidence(parse(), ZIP, CATALOG, {
    fetcher: async () => ({ ok: false }), cryptoApi: webcrypto, now: NOW
  }), /GITHUB_READ_UNAVAILABLE/);
});
