import assert from "node:assert/strict";
import test from "node:test";
import { inventoryEvidence, inventoryRows, parseReadinessProfiles } from "../src/r9-turn-queue.mjs";

const source = "a".repeat(40);
const now = Date.parse("2026-11-18T22:00:00Z");
const repo = { id: 71, name: "App", full_name: "MichaelWave369/App", language: "TypeScript" };
const profile = {
  repository: repo.full_name, repository_id: repo.id, source_sha: source, kind: "application",
  integration: { status: "staging_only", candidate: "app-web" }, distribution: "held",
  build_artifact: { path: "dist", sha256: null }, required_tests: ["Cold launch"],
  human_acceptance: ["Accept the offline package."],
};
const profileJson = (...profiles) => JSON.stringify({
  schema_version: "phios.fleet_readiness.v1", owner: "MichaelWave369", profiles,
});

test("readiness joins by both repository identity and name", () => {
  const profiles = parseReadinessProfiles(profileJson(profile));
  const replacement = { ...repo, id: 72 };
  const renamed = { ...repo, name: "OldApp", full_name: "MichaelWave369/OldApp" };
  const example = { ...repo, id: -1, exampleOnly: true };
  assert.deepEqual(inventoryRows([repo, replacement, renamed, example], profiles, " Application "),
    [{ repo, profile: profiles[0] }]);
  assert.deepEqual(inventoryRows([repo, replacement, renamed, example], profiles, "unprofiled"),
    [{ repo: replacement, profile: null }, { repo: renamed, profile: null }]);
  assert.deepEqual(profiles[0].tests, ["Cold launch"]);
  assert.deepEqual(profiles[0].artifact, { path: "dist", sha256: null });
});

test("invalid profiles cannot attach ambiguous or promoted readiness", () => {
  assert.throws(() => parseReadinessProfiles(profileJson(profile, { ...profile })), /Invalid readiness/);
  assert.throws(() => parseReadinessProfiles(profileJson(profile, { ...profile, repository_id: 72 })),
    /Invalid readiness/);
  assert.throws(() => parseReadinessProfiles(profileJson({ ...profile, required_tests: [] })),
    /Invalid readiness/);
  assert.throws(() => parseReadinessProfiles(profileJson({ ...profile, distribution: "ready" })),
    /Invalid readiness/);
  const reviewedLater = { ...profile, integration: { status: "candidate_review", candidate: null },
    build_artifact: null };
  assert.equal(parseReadinessProfiles(profileJson(reviewedLater))[0].distribution, "held");
  assert.throws(() => parseReadinessProfiles(profileJson({ ...reviewedLater, distribution: "not_requested" })),
    /Invalid readiness/);
});

test("live CI, profile provenance and rolling coverage are distinct evidence", () => {
  const [parsed] = parseReadinessProfiles(profileJson(profile));
  const signal = {
    repository: repo.full_name, repositoryId: repo.id, headSha: "b".repeat(40),
    from: "LIVE_PUBLIC_GITHUB_API_READ_ONLY", observedAt: new Date(now).toISOString(),
    functionallyVerified: false, mergeAuthorized: false,
    ci: { state: "OBSERVED_GREEN_AT_HEAD" }, openPrs: [],
  };
  const cohort = {
    state: "RECENT_CLEAN", source: "PUBLIC_COHORT_OBSERVATION_NOT_FUNCTIONAL_PROOF", completed: false,
  };
  const observed = inventoryEvidence(repo, parsed, { [repo.id]: signal }, { byRepo: { App: cohort } }, now);
  assert.equal(observed.profileCurrent, false);
  assert.equal(observed.live.functionallyVerified, false);
  assert.equal(observed.live.ciState, "OBSERVED_GREEN_AT_HEAD");
  assert.equal(observed.cohort, cohort);
  const stale = inventoryEvidence(repo, parsed, { [repo.id]: signal }, {}, now + 60 * 60 * 1000);
  assert.equal(stale.profileCurrent, null);
  assert.equal(stale.live.state, "STALE_SIGNAL");
});
