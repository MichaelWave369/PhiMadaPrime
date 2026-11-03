import test from "node:test";
import assert from "node:assert/strict";
import { newContract } from "../src/contracts.mjs";
import { pilotCoverage, PILOT_AUTOMATED_CHECKS } from "../src/pilot-coverage.mjs";

const SHA = "a".repeat(40);
const NEXT = "b".repeat(40);
const REPO = { id: 1443845098, name: "PhiMadaPrime",
  full_name: "MichaelWave369/PhiMadaPrime", exampleOnly: false };
const NOW = () => new Date("2026-11-03T19:00:00Z");
const contract = (sha = SHA, types = ["web_app"]) => newContract(REPO, types, sha, NOW);
const result = (extra = {}) => ({
  sourceSha: SHA, currentHeadSha: SHA,
  status: "GITHUB_ARTIFACT_AND_SOURCE_METADATA_CORRELATED",
  archiveDigestMatched: true, githubRunMatched: true,
  githubArtifactMatched: true, currentShaMatched: true,
  productVerified: false, mergeAuthorized: false,
  completionVerified: false, ...extra
});

test("fixed automated check set is strictly two checks", () => {
  assert.deepEqual([...PILOT_AUTOMATED_CHECKS],
    ["production_build", "automated_tests"]);
});

test("matching web app contract maps only two reported outcomes", () => {
  const coverage = pilotCoverage(result(), contract());
  assert.equal(coverage.sourceState, "MATCHING_LOCAL_CONTRACT");
  assert.equal(coverage.totalChecks, 5);
  assert.equal(coverage.reportedAutomatedChecks, 2);
  assert.equal(coverage.independentlyVerifiedChecks, 0);
  assert.equal(coverage.completedChecks, 0);
  assert.equal(coverage.productVerified, false);
  assert.equal(coverage.mergeAuthorized, false);
  assert.equal(coverage.rows.filter(x => x.status ===
    "PILOT_EXIT_ZERO_REPORTED_FOR_SHA").length, 2);
  assert.deepEqual(coverage.rows.filter(x => x.status ===
    "PILOT_EXIT_ZERO_REPORTED_FOR_SHA").map(x => x.id),
    ["production_build", "automated_tests"]);
  for (const id of ["browser_interaction", "accessibility", "deployed_revision"]) {
    const row = coverage.rows.find(x => x.id === id);
    assert.equal(row.status, "NOT_COVERED_BY_R06_PILOT");
    assert.equal(row.independentlyVerified, false);
    assert.equal(row.accepted, false);
  }
});

test("no contract offers web-app template only without accepted check counts", () => {
  const coverage = pilotCoverage(result(), null);
  assert.equal(coverage.sourceState, "NO_LOCAL_CONTRACT");
  assert.equal(coverage.isPreview, true);
  assert.equal(coverage.reportedAutomatedChecks, 0);
  assert.equal(coverage.totalChecks, 5);
  assert.equal(coverage.rows.filter(x => x.status ===
    "POTENTIAL_AUTOMATED_COVERAGE_NO_CONTRACT").length, 2);
});

test("changed local contract SHA rejects evidence mapping", () => {
  const coverage = pilotCoverage(result(), contract(NEXT));
  assert.equal(coverage.sourceState, "CONTRACT_SHA_MISMATCH");
  assert.equal(coverage.reportedAutomatedChecks, 0);
  assert.equal(coverage.rows.filter(x => x.status ===
    "PILOT_EXIT_ZERO_REPORTED_FOR_SHA").length, 0);
});

test("source drift and in-flight changes cannot map current coverage", () => {
  for (const change of [
    { currentHeadSha: NEXT, currentShaMatched: false,
      status: "HISTORICAL_SHA_SOURCE_HAS_MOVED" },
    { currentHeadSha: NEXT, currentShaMatched: false,
      status: "HEAD_CHANGED_DURING_OBSERVATION" },
    { archiveDigestMatched: false },
    { githubRunMatched: false }, { githubArtifactMatched: false },
    { productVerified: true }, { mergeAuthorized: true },
    { completionVerified: true }
  ]) {
    const c = pilotCoverage(result(change), contract());
    assert.equal(c.sourceState, "PILOT_SOURCE_OR_METADATA_NOT_CURRENT");
    assert.equal(c.reportedAutomatedChecks, 0);
    assert.equal(c.completedChecks, 0);
  }
});

test("empty result never maps to reported tests", () => {
  const c = pilotCoverage(null, contract());
  assert.equal(c.sourceState, "NO_PILOT_REVIEW");
  assert.equal(c.reportedAutomatedChecks, 0);
});

test("other repo cannot piggyback PhiMada pilot", () => {
  const foreign = { ...contract(), repository: "MichaelWave369/BTM" };
  const c = pilotCoverage(result(), foreign);
  assert.equal(c.sourceState, "INCOMPATIBLE_LOCAL_CONTRACT");
  assert.equal(c.reportedAutomatedChecks, 0);
});

test("manual-only and research contracts are never treated as web app checks", () => {
  for (const types of [["manual_review"], ["research"]]) {
    const c = pilotCoverage(result(), contract(SHA, types));
    assert.equal(c.sourceState, "INCOMPATIBLE_LOCAL_CONTRACT");
    assert.equal(c.isPreview, true);
    assert.equal(c.completedChecks, 0);
  }
});

test("multi-surface contract displays required gaps without crediting other checks", () => {
  const c = pilotCoverage(result(), contract(SHA, ["web_app", "webxr"]));
  assert.equal(c.sourceState, "MATCHING_LOCAL_CONTRACT");
  assert.equal(c.reportedAutomatedChecks, 2);
  assert(c.rows.some(x => x.id === "headset_input" &&
    x.status === "NOT_COVERED_BY_R06_PILOT"));
  assert(c.rows.some(x => x.id === "comfort_acceptance" &&
    x.status === "NOT_COVERED_BY_R06_PILOT"));
  assert.equal(c.independentlyVerifiedChecks, 0);
});

test("local operator annotations do not increase independently verified count", () => {
  const annotated = contract();
  annotated.checks[0].locally_reviewed = true;
  annotated.checks[1].locally_reviewed = true;
  const c = pilotCoverage(result(), annotated);
  assert.equal(c.reportedAutomatedChecks, 2);
  assert.equal(c.independentlyVerifiedChecks, 0);
  assert.equal(c.completedChecks, 0);
});

test("malformed contract does not allow coverage promotion", () => {
  for (const change of [
    { repository_id: 5 },
    { checks: [{ id: "merge_authorized" }] },
    { checks: [] }, { source_sha: "HEAD" }
  ]) {
    const c = pilotCoverage(result(), { ...contract(), ...change });
    assert.notEqual(c.sourceState, "MATCHING_LOCAL_CONTRACT");
    assert.equal(c.reportedAutomatedChecks, 0);
  }
});
