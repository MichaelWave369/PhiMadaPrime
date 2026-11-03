import test from "node:test";
import assert from "node:assert/strict";
import { triageForRecord, triageOverview, triageSummary } from "../src/triage.mjs";
import { coverageFailureReason } from "../src/coverage.mjs";

const OWNER = "MichaelWave369";
const repo = { id: 17, name: "BTM", full_name: OWNER + "/BTM", exampleOnly: false };
const baseline = {
  state: "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED",
  ci: "NO_RECENT_RUN_AT_HEAD",
  pages: "HTML_REACHABLE_NOT_RUNTIME_VERIFIED",
  release: "NO_PUBLISHED_RELEASE_FOUND",
  limitations: [],
  observedAt: "2026-11-03T07:20:19Z"
};

test("no observation means awaiting scan, not failed or completed", () => {
  const tasks = triageForRecord(repo, null);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].code, "WAIT_FOR_OBSERVATION");
  assert.equal(tasks[0].level, "pending");
  assert.equal(tasks[0].weight, 20);
  const unknown = triageForRecord(repo, { state: "NEVER_OBSERVED" });
  assert.equal(unknown[0].code, "WAIT_FOR_OBSERVATION");
});

test("CI and Pages hints remain conditional on project acceptance needs", () => {
  const tasks = triageForRecord(repo, baseline);
  const codes = tasks.map(x => x.code);
  assert(codes.includes("CHECK_CI_EXPECTATION"));
  assert(codes.includes("VERIFY_WEB_RUNTIME"));
  assert(codes.includes("REVIEW_RELEASE_EXPECTATION"));
  assert(tasks.every(x => x.action.length > 15));
  assert(tasks.every(x => !/merge this|dispatch now|complete product/i.test(x.action)));
});

test("metadata observations do not manufacture proven CI or release problems", () => {
  const tasks = triageForRecord(repo, {
    ...baseline,
    ci: "OBSERVED_RUNS_GREEN_AT_HEAD_NOT_BUILD_PROOF",
    pages: "NOT_CONFIGURED_OR_NOT_ACCESSIBLE",
    release: "PUBLISHED_METADATA_NOT_FUNCTIONALITY_VERIFIED"
  });
  const codes = tasks.map(x => x.code);
  assert(!codes.includes("REVIEW_CI_ISSUE"));
  assert(!codes.includes("CHECK_CI_EXPECTATION"));
  assert(codes.includes("REVIEW_DEPLOYMENT_NEED"));
  assert(codes.includes("VERIFY_RELEASE_RUNTIME"));
  assert(tasks.find(x => x.code === "REVIEW_DEPLOYMENT_NEED").action.includes("may not need Pages"));
});

test("observed limitations and stale pushed commits outrank routine waiting", () => {
  const stale = triageForRecord(repo, { ...baseline, state: "STALE_AFTER_PUSH" });
  const limited = triageForRecord(repo, { ...baseline, state: "RECENT_LIMITED_OBSERVATION" });
  const aged = triageForRecord(repo, { ...baseline, state: "STALE_BY_AGE" });
  assert.equal(stale[0].code, "RECHECK_CHANGED_REPO");
  assert.equal(limited[0].code, "REVIEW_SCAN_LIMITS");
  assert.equal(aged[0].code, "RECHECK_AGED_REPO");
  assert(!stale.some(x => x.code === "VERIFY_WEB_RUNTIME"));
});

test("triage overview binds to actual public repo and never authorizes execution", () => {
  const rows = [
    repo,
    { id: 20, name: "Research", full_name: OWNER + "/Research", exampleOnly: false },
    { id: -1, name: "Demo", full_name: OWNER + "/Demo", exampleOnly: true }
  ];
  const coverage = { byRepo: { BTM: baseline, Research: { ...baseline,
    state: "STALE_AFTER_PUSH" } } };
  const list = triageOverview(coverage, rows);
  const stats = triageSummary(list);
  assert(stats.affectedRepositories === 2);
  assert(stats.prompts >= 4);
  assert(list.every(x => x.dispatchable === false && x.verifiedComplete === false));
  assert(list.every(x => x.advisoryOnly === true));
  assert(list.every(x => x.source === "PUBLIC_COHORT_METADATA_HINT_NOT_AGENTORA_PLAN"));
  assert(!list.some(x => x.repoName === "Demo"));
  assert.equal(stats.verifiedComplete, 0);
  assert.equal(stats.dispatched, 0);
});

test("unscanned repos do not drown out observed evidence priorities", () => {
  const rows = [repo, ...Array.from({ length: 30 }, (_, i) => ({
    id: i + 30, name: "Wait" + i, full_name: OWNER + "/Wait" + i,
    exampleOnly: false
  }))];
  const list = triageOverview({ byRepo: { BTM: baseline } }, rows);
  assert(list[0].weight > 20);
  assert.notEqual(list[0].code, "WAIT_FOR_OBSERVATION");
  assert.equal(list.filter(x => x.code === "WAIT_FOR_OBSERVATION").length, 30);
});

test("coverage failure diagnostics expose known reason without leaking arbitrary input", () => {
  const valid = coverageFailureReason(new Error("COVERAGE_HASH_MISMATCH"));
  assert.equal(valid.code, "COVERAGE_HASH_MISMATCH");
  assert.match(valid.message, /integrity/i);
  const hostile = coverageFailureReason(new Error("private/token/hunter2"));
  assert.equal(hostile.code, "COVERAGE_READ_FAILED");
  assert(!hostile.message.includes("hunter2"));
  assert(coverageFailureReason(null).message);
});
