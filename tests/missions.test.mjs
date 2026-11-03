import test from "node:test";
import assert from "node:assert/strict";
import { missionQueue, filterMissions, missionStats, handoffText } from "../src/missions.mjs";
import { parseOfficeArtifact } from "../src/audit.mjs";

const owner = "MichaelWave369";
const repos = [
  { name: "Agentora", id: 101, full_name: owner + "/Agentora", exampleOnly: false,
    description: "Fleet orchestration" },
  { name: "BTM", id: 102, full_name: owner + "/BTM", exampleOnly: false,
    description: "Retro FPS" },
  { name: "PrivateProject", id: -1, full_name: owner + "/PrivateProject",
    exampleOnly: true, description: "Not discovered" }
];
const sha = "a".repeat(40);
function plan(tasks) {
  return {
    type: "plan", generated_utc: "2026-11-03T10:00:00Z", freshness: "RECENT",
    priorityQueue: tasks
  };
}
function task(repository, check, priority, extra = {}) {
  return {
    repository, check_id: check, priority, summary: "Verify " + check,
    head_sha: sha, state: "REVIEW_ONLY_NOT_DISPATCHABLE", ...extra
  };
}

test("mission queue binds every proposal to public catalog identity and no authority", () => {
  const queue = missionQueue(plan([
    task(owner + "/BTM", "browser_smoke", 90),
    task(owner + "/Agentora", "automated_tests", 100),
    task(owner + "/PrivateProject", "build", 500),
    task("attacker/Repo", "build", 800),
    task(owner + "/Agentora", "merge", 900, { state: "DISPATCHABLE" })
  ]), repos);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].repoName, "Agentora");
  assert.equal(queue[0].priority, 100);
  assert.equal(queue[1].wing, "games");
  assert(queue.every(x => x.dispatchable === false && x.verifiedComplete === false));
  assert(queue.every(x => x.provenance === "AGENTORA_REVIEW_ONLY_PLAN"));
});

test("duplicate checks have distinct stable review keys", () => {
  const input = plan([task(owner + "/BTM", "browser_smoke", 90),
    task(owner + "/BTM", "browser_smoke", 90)]);
  const one = missionQueue(input, repos);
  const two = missionQueue(input, repos);
  assert.equal(new Set(one.map(x => x.id)).size, 2);
  assert.deepEqual(one, two);
});

test("pinning and locally reviewed state never imply execution", () => {
  const queue = missionQueue(plan([
    task(owner + "/BTM", "browser_smoke", 90),
    task(owner + "/Agentora", "automated_tests", 100)
  ]), repos);
  const reviewed = { [queue[0].id]: true };
  const pinned = { [queue[1].id]: true };
  assert.deepEqual(missionStats(queue, reviewed, pinned),
    { proposed: 2, localReviewed: 1, pinned: 1, verifiedComplete: 0, dispatched: 0 });
  const pending = filterMissions(queue, { review: "pending", reviewed, pinned });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, queue[1].id);
  assert.equal(filterMissions(queue, { review: "reviewed", reviewed }).length, 1);
  assert.equal(filterMissions(queue, { review: "pinned", pinned }).length, 1);
});

test("filter by department, repo, and check type", () => {
  const queue = missionQueue(plan([
    task(owner + "/BTM", "browser_smoke", 90),
    task(owner + "/Agentora", "automated_tests", 100)
  ]), repos);
  assert.equal(filterMissions(queue, { wing: "games" }).length, 1);
  assert.equal(filterMissions(queue, { query: "browser" })[0].repoName, "BTM");
  assert.equal(filterMissions(queue, { query: "not-found" }).length, 0);
  assert.equal(filterMissions(queue, { query: "agentora" })[0].repoName, "Agentora");
});

test("manual handoff includes exact source SHA and explicit non-dispatch authority", () => {
  const mission = missionQueue(plan([
    task(owner + "/Agentora", "automated_tests", 100)
  ]), repos)[0];
  const text = handoffText(mission, plan([]));
  assert.match(text, /NOT DISPATCHED/);
  assert.match(text, /MANUAL|manual review/i);
  assert.match(text, new RegExp(sha));
  assert.match(text, /Agentora/);
  assert.throws(() => handoffText({ ...mission, dispatchable: true }, plan([])),
    /UNSAFE_HANDOFF/);
  assert.throws(() => handoffText({ ...mission, verifiedComplete: true }, plan([])),
    /UNSAFE_HANDOFF/);
});

test("missing SHA remains unverified in handoff and no invented completion", () => {
  const queue = missionQueue(plan([task(owner + "/BTM", "browser_smoke", 90,
    { head_sha: "MISSING" })]), repos);
  assert.equal(queue[0].headSha, null);
  assert.match(handoffText(queue[0], plan([])), /UNVERIFIED, MUST RESOLVE/);
});

test("full Agentora plan import retains all 230 proposed jobs, not just first 200", () => {
  const data = {
    schema: "agentora.fleet.plan.v0.2", generated_utc: new Date().toISOString(),
    owner, public_output: true, merge_authorized: false,
    job_dispatch_authorized: false,
    profiles: [{ repository: owner + "/Agentora", completion: "UNVERIFIED",
      head_sha: sha, operator_review_required: true, surface_candidates: [],
      observations: { ci: "NOT_VERIFIED" } }],
    tasks: Array.from({ length: 230 }, (_, i) => ({
      ...task(owner + "/Agentora", "test_" + i, 50),
      summary: "Review test #" + i
    }))
  };
  const imported = parseOfficeArtifact(JSON.stringify(data), [repos[0]]);
  assert.equal(imported.priorityQueue.length, 230);
  const queue = missionQueue(imported, [repos[0]]);
  assert.equal(queue.length, 230);
  assert.equal(new Set(queue.map(x => x.id)).size, 230);
});

test("empty/absent plan produces no imaginary job proposals", () => {
  assert.deepEqual(missionQueue(null, repos), []);
  assert.deepEqual(missionQueue({ type: "plan", priorityQueue: [] }, repos), []);
  assert.deepEqual(missionQueue(plan([task(owner + "/Agentora", "build", 10)]),
    [{ ...repos[0], exampleOnly: true }]), []);
});
