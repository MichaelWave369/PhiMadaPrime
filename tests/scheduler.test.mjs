import test from "node:test";
import assert from "node:assert/strict";
import { parseDependencyRules, previewFleetSchedule, mergeGatePreview } from "../src/scheduler.mjs";

const OWNER = "MichaelWave369";
const sha = "a".repeat(40), other = "b".repeat(40);
const NOW = Date.parse("2026-11-03T15:00:00Z");
const plan = { type: "plan", freshness: "RECENT", generated_utc: "2026-11-03T14:00:00Z" };
const catalog = ["BTM", "OverStrings", "PhiOS", "Agentora", "PhiServe"].map((name, i) =>
  ({ name, id: i + 1, full_name: OWNER + "/" + name, exampleOnly: false }));
function mission(name, check, priority, headSha = sha) {
  return { repository: OWNER + "/" + name, repoName: name,
    repoId: catalog.find(x => x.name === name).id, check, priority,
    headSha, provenance: "AGENTORA_REVIEW_ONLY_PLAN", dispatchable: false,
    verifiedComplete: false };
}

test("parallel slots are per-repo and never produce real dispatch or merge authority", () => {
  const queue = [mission("BTM", "build", 99), mission("BTM", "headset", 90),
    mission("PhiOS", "test", 88), mission("Agentora", "build", 70)];
  const x = previewFleetSchedule(queue, plan, { parallelism: 2, now: NOW });
  assert.deepEqual(x.slots.map(a => a.repoName), ["BTM", "PhiOS"]);
  assert.deepEqual(x.slots.map(a => a.jobCount), [2, 1]);
  assert.equal(x.backlog.length, 1);
  assert.equal(x.totalProposals, 4);
  assert.equal(x.actualWorkers, 0);
  assert.equal(x.dispatched, 0);
  assert.equal(x.mergeAuthorized, false);
  assert(x.slots.every(s => !s.dispatchable && !s.verifiedComplete));
});

test("explicit dependencies hold dependent work, even if both source SHAs exist", () => {
  const deps = parseDependencyRules("BTM needs OverStrings\nPhiOS needs BTM", catalog);
  const x = previewFleetSchedule([mission("BTM", "test", 99),
    mission("PhiOS", "build", 90), mission("Agentora", "test", 30)],
  plan, { dependencies: deps, now: NOW });
  assert.deepEqual(x.slots.map(s => s.repoName), ["Agentora"]);
  assert.equal(x.held.length, 2);
  assert(x.held.every(x => x.reason === "DEPENDENCY_RECEIPT_NOT_VERIFIED"));
  assert.deepEqual(x.held[0].dependencies, ["OverStrings"]);
});

test("dependency parser rejects unknown, private/demo, self, cycle and malformed lines", () => {
  const demo = [...catalog, { name: "Hidden", id: 99,
    full_name: OWNER + "/Hidden", exampleOnly: true }];
  for (const input of ["BTM -> PhiOS", "BTM needs Missing", "BTM needs Hidden",
    "BTM needs BTM", "BTM needs PhiOS\nPhiOS needs BTM"] ) {
    assert.throws(() => parseDependencyRules(input, demo), /RULES_/);
  }
  assert.deepEqual(parseDependencyRules("btm needs phiOS\nBTM needs PhiOS", catalog),
    [{ repository: "BTM", requires: "PhiOS" }]);
});

test("missing or inconsistent SHA, stale plan and occupied preview leases are held", () => {
  const queue = [mission("BTM", "build", 99, other),
    mission("BTM", "test", 80, sha), mission("PhiOS", "build", 50),
    mission("Agentora", "test", 40, null)];
  const x = previewFleetSchedule(queue, plan, {
    now: NOW, occupiedRepositories: [OWNER + "/PhiOS"]
  });
  assert.equal(x.slots.length, 0);
  assert.equal(x.held.find(x => x.repoName === "BTM").reason, "MISSING_OR_CONFLICTING_SOURCE_SHA");
  assert.equal(x.held.find(x => x.repoName === "PhiOS").reason, "REPOSITORY_RESERVED_IN_PREVIEW");
  assert.equal(x.held.find(x => x.repoName === "Agentora").reason, "MISSING_OR_CONFLICTING_SOURCE_SHA");
  const stale = previewFleetSchedule([mission("BTM", "build", 80)],
    { ...plan, freshness: "RECENT", generated_utc: "2026-11-01T01:00:00Z" }, { now: NOW });
  assert.equal(stale.planFresh, false);
  assert.equal(stale.held[0].reason, "STALE_OR_MISSING_PLAN");
});

test("untrusted dispatchable jobs cannot enter the scheduling preview", () => {
  const bad = { ...mission("BTM", "build", 100), dispatchable: true };
  assert.equal(previewFleetSchedule([bad], plan, { now: NOW }).totalRepositories, 0);
  assert.throws(() => previewFleetSchedule([], plan, { parallelism: 13 }), /SCHEDULE_INPUT_INVALID/);
});

test("merge gate remains closed with apparently matching SHA or local checkmarks", () => {
  assert.deepEqual(mergeGatePreview({ headSha: sha }, other),
    { authorized: false, reason: "SOURCE_SHA_MISMATCH_OR_UNKNOWN" });
  assert.deepEqual(mergeGatePreview({ headSha: sha, locallyReviewed: true }, sha),
    { authorized: false, reason: "INDEPENDENT_AGENTORA_AND_GITHUB_GATES_REQUIRED" });
});
