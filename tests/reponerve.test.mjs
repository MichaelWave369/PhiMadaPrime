import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRepoNervePublic } from "../src/reponerve.mjs";

const now = Date.parse("2026-11-07T16:00:00Z");
const observed_at = new Date(now - 60000).toISOString();
const repo = { id: 42, name: "BTM", full_name: "MichaelWave369/BTM", exampleOnly: false };
const catalog = [repo];
function sample() {
  return {
    schema: "phireponerve.agentora.public-observations.v1",
    owner: "MichaelWave369", scope: "public_only",
    source: "PHIREPONERVE_LOCAL_R1", source_scan_id: 7,
    observed_at, public_repo_count: 1,
    repositories: [{ github_id: 42, full_name: repo.full_name,
      archived: false, source_only: true, verified_complete: false }],
    recent_events: [{ id: 1, github_id: 42, full_name: repo.full_name,
      event_type: "first_observed", observed_at }],
    source_only: true, dispatch_authorized: false, merge_authorized: false,
    verified_complete: false
  };
}
function parse(data, rows = catalog) {
  return parseRepoNervePublic(JSON.stringify(data), rows, now);
}
test("R1 public observations accept exact Agentora shape and preserve non-authority", () => {
  const r = parse(sample());
  assert.equal(r.publicRepoCount, 1);
  assert.equal(r.events[0].repo, "BTM");
  assert.equal(r.dispatchAuthorized, false);
  assert.equal(r.mergeAuthorized, false);
  assert.match(r.status, /NOT_RELEASE_VERIFICATION/);
});
test("refuse private fields even when values suggest public", () => {
  const s = sample();
  s.repositories[0].private = false;
  assert.throws(() => parse(s), /REJECTED/);
  delete s.repositories[0].private;
  s.private_repositories = [{ name: "hidden" }];
  assert.throws(() => parse(s), /REJECTED/);
});
test("refuse forged authority and claims of completed product", () => {
  for (const [k,v] of [["merge_authorized",true],["dispatch_authorized",true],
    ["verified_complete",true],["scope","all"]]) {
    assert.throws(() => parse({...sample(),[k]:v}), /REJECTED/);
  }
});
test("refuse identity drift, nonexistent repos and duplicate IDs", () => {
  const s = sample();
  s.repositories[0].github_id = 99;
  assert.throws(() => parse(s), /REJECTED/);
  s.repositories[0].github_id = 42;
  s.repositories[0].full_name = "MichaelWave369/Other";
  assert.throws(() => parse(s), /REJECTED/);
  assert.throws(() => parse(sample(), [{...repo,exampleOnly:true}]), /REJECTED/);
  const dupe = sample();
  dupe.repositories.push({...dupe.repositories[0]});
  dupe.public_repo_count = 2;
  assert.throws(() => parse(dupe), /REJECTED/);
});
test("refuse stale observations, unknown events, hidden old names and executable requests", () => {
  const stale = sample();
  stale.observed_at = "2026-10-01T00:00:00Z";
  assert.throws(() => parse(stale), /REJECTED/);
  const evt = sample();
  evt.recent_events[0].event_type = "visibility_changed";
  assert.throws(() => parse(evt), /REJECTED/);
  evt.recent_events[0].event_type = "renamed";
  evt.recent_events[0].before_value = "PrivateOldName";
  assert.throws(() => parse(evt), /REJECTED/);
  const dispatch = sample();
  dispatch.recent_events[0].command = "deploy";
  assert.throws(() => parse(dispatch), /REJECTED/);
});
test("public Pages view never fetches RepoNerve loopback or credentials", () => {
  const panel = readFileSync("src/reponerve.jsx", "utf8");
  const main = readFileSync("src/main.jsx", "utf8");
  assert.match(main, /RepoNervePanel/);
  assert.doesNotMatch(panel, /fetch\(|localhost|127\.0\.0\.1|GITHUB_TOKEN|localStorage/i);
  assert.match(panel, /type="file"/);
});
