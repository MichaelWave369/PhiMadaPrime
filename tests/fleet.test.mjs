import test from "node:test";
import assert from "node:assert/strict";
import {
  DESKS_PER_FLOOR, OWNER, normalizeRepo, orderFleet, fetchPublicFleet,
  floorStations, floorOfRepo, floorsForCount, safeExternalSite
} from "../src/fleet.mjs";
import { parseOfficeArtifact } from "../src/audit.mjs";

const row = (name, id, extra = {}) => ({
  name, id, owner: { login: OWNER }, full_name: OWNER + "/" + name,
  private: false, archived: false, description: name, language: "JavaScript",
  pushed_at: "2026-11-01T15:00:00Z", homepage: null,
  ...extra
});
const repo = normalizeRepo(row("PhiOS", 42));

test("twelve stations are reserved per floor with no dropped repos", () => {
  const repos = Array.from({ length: 25 }, (_, index) => normalizeRepo(
    row("Repo" + index, index + 1)));
  assert.equal(DESKS_PER_FLOOR, 12);
  assert.equal(floorsForCount(0), 1);
  assert.equal(floorsForCount(12), 1);
  assert.equal(floorsForCount(13), 2);
  assert.equal(floorsForCount(25), 3);
  assert.equal(floorStations(repos, 1).length, 12);
  assert.equal(floorStations(repos, 2).filter(Boolean).length, 12);
  assert.equal(floorStations(repos, 3).filter(Boolean).length, 1);
  assert.equal(floorStations(repos, 3).filter(x => x === null).length, 11);
  assert.equal(floorOfRepo(repos, repos[24].id), 3);
  assert.deepEqual(floorStations(repos, 99), []);
});

test("public-only normalization rejects private, foreign and malformed records", () => {
  assert.equal(normalizeRepo(row("secret", 1, { private: true })), null);
  assert.equal(normalizeRepo(row("fake", 2, { owner: { login: "attacker" } })), null);
  assert.equal(normalizeRepo(row("../evil", 3)), null);
  assert.equal(normalizeRepo(row("PhiOS", -1)), null);
  assert.equal(normalizeRepo(row("PhiOS", 4, { full_name: "attacker/PhiOS" })), null);
  assert.equal(repo.html_url, "https://github.com/MichaelWave369/PhiOS");
});

test("homepage links are restricted to https", () => {
  assert.equal(safeExternalSite("javascript:alert(1)"), "");
  assert.equal(safeExternalSite("http://example.org"), "");
  assert.equal(safeExternalSite("https://example.org/project"), "https://example.org/project");
  assert.equal(safeExternalSite("https://user:pass@example.org"), "");
});

test("flagship order is deterministic and remaining names are alphabetical", () => {
  const repos = orderFleet(["Zebra", "PhiOS", "Agentora", "Alpha"]
    .map((n, i) => normalizeRepo(row(n, i + 1))));
  assert.deepEqual(repos.map(r => r.name), ["Agentora", "PhiOS", "Alpha", "Zebra"]);
});

test("GitHub pagination exhausts all public pages and excludes private entries", async () => {
  const paths = [];
  const first = Array.from({ length: 100 }, (_, i) => row("R" + i, i + 1));
  const next = [row("PhiOS", 101), row("internal", 102, { private: true })];
  const fakeFetch = async (url, opts) => {
    paths.push(url);
    assert.equal(opts.headers.Accept, "application/vnd.github+json");
    return { ok: true, json: async () => url.endsWith("page=1") ? first : next };
  };
  const result = await fetchPublicFleet(fakeFetch);
  assert.equal(result.length, 101);
  assert.equal(result[0].name, "PhiOS");
  assert.equal(paths.length, 2);
  assert(paths.every(x => x.startsWith("https://api.github.com/users/MichaelWave369/repos?")));
});

test("unexhausted GitHub inventory is held, never reported complete", async () => {
  const fakeFetch = async () => ({ ok: true,
    json: async () => Array.from({ length: 100 }, (_, i) => row("R" + i, i + 1)) });
  await assert.rejects(fetchPublicFleet(fakeFetch, 1), /GITHUB_CATALOG_INCOMPLETE/);
  await assert.rejects(fetchPublicFleet(async () => ({ ok: false }), 1),
    /GITHUB_CATALOG_UNAVAILABLE/);
});

const audit = () => ({
  schema: "agentora.fleet.audit.v0.1",
  generated_utc: new Date().toISOString(),
  owner: OWNER, merge_authorized: false, job_dispatch_authorized: false,
  private_included: false, repository_count: 1, deep_audited_count: 1,
  repositories: [{
    repository: OWNER + "/PhiOS", repository_id: 42, visibility: "public",
    completion: "UNVERIFIED", head_sha: "a".repeat(40),
    ci: "OBSERVED_RUNS_GREEN_AT_HEAD_NOT_BUILD_PROOF",
    pages: "HTML_REACHABLE_NOT_RUNTIME_VERIFIED",
    release: "PUBLISHED_METADATA_NOT_FUNCTIONALITY_VERIFIED",
    relationships: ["Agentora"], roadmap: ["Verify runtime launch"]
  }]
});

test("matching public R0.1 audit loads without pretending product completion", () => {
  const result = parseOfficeArtifact(JSON.stringify(audit()), [repo]);
  assert.equal(result.type, "audit");
  assert.equal(result.byRepo.PhiOS.completion, "UNVERIFIED");
  assert.match(result.byRepo.PhiOS.ci, /NOT_BUILD_PROOF/);
  assert.equal(result.byRepo.PhiOS.tasks[0], "Verify runtime launch");
});

test("private audit, forged completion, and authority are refused", () => {
  const privateAudit = audit();
  privateAudit.private_included = true;
  assert.throws(() => parseOfficeArtifact(JSON.stringify(privateAudit), [repo]),
    /PRIVATE_OR_INCOMPLETE/);
  const forged = audit();
  forged.repositories[0].completion = "COMPLETE";
  assert.throws(() => parseOfficeArtifact(JSON.stringify(forged), [repo]),
    /UNTRUSTED_COMPLETION/);
  const authority = audit();
  authority.merge_authorized = true;
  assert.throws(() => parseOfficeArtifact(JSON.stringify(authority), [repo]),
    /AUTHORITY_INVALID/);
});

test("unmatched repo id is never given another repo's evidence", () => {
  const wrongId = audit();
  wrongId.repositories[0].repository_id = 99;
  const parsed = parseOfficeArtifact(JSON.stringify(wrongId), [repo]);
  assert.deepEqual(parsed.byRepo, {});
});

const plan = () => ({
  schema: "agentora.fleet.plan.v0.2", generated_utc: new Date().toISOString(),
  owner: OWNER, public_output: true, merge_authorized: false,
  job_dispatch_authorized: false,
  profiles: [{
    repository: OWNER + "/PhiOS", completion: "UNVERIFIED",
    operator_review_required: true, head_sha: "a".repeat(40),
    surface_candidates: ["web_app"],
    observations: { ci: "NOT_VERIFIED", pages: "NOT_VERIFIED", release: "NOT_VERIFIED" }
  }],
  tasks: [{
    repository: OWNER + "/PhiOS", state: "REVIEW_ONLY_NOT_DISPATCHABLE",
    summary: "Verify exact commit build"
  }]
});

test("R0.2 plan remains read-only; dispatch claims are rejected", () => {
  const parsed = parseOfficeArtifact(JSON.stringify(plan()), [repo]);
  assert.equal(parsed.type, "plan");
  assert.equal(parsed.byRepo.PhiOS.tasks.length, 1);
  const unsafe = plan();
  unsafe.tasks[0].state = "DISPATCHABLE";
  assert.throws(() => parseOfficeArtifact(JSON.stringify(unsafe), [repo]),
    /DISPATCH_CLAIM_REJECTED/);
});

test("untrusted private R0.2 plan and unknown repo references are rejected", () => {
  const privatePlan = plan();
  privatePlan.public_output = false;
  assert.throws(() => parseOfficeArtifact(JSON.stringify(privatePlan), [repo]),
    /PRIVATE_OR_INVALID_PLAN/);
  const unknown = plan();
  unknown.tasks[0].repository = OWNER + "/PrivateProject";
  assert.throws(() => parseOfficeArtifact(JSON.stringify(unknown), [repo]),
    /UNKNOWN_TASK_REJECTED/);
});
