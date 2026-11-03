import test from "node:test";
import assert from "node:assert/strict";
import { newContract, updateContract } from "../src/contracts.mjs";
import {
  prepareVerificationRequest, verificationHandoffMessage, VERIFY_REQUEST_SCHEMA,
  MAX_VERIFY_REQUEST_BYTES
} from "../src/verification-request.mjs";

const repo = {
  id: 42, name: "BTM", full_name: "MichaelWave369/BTM",
  exampleOnly: false
};
const HEAD = "a".repeat(40), OTHER = "b".repeat(40);
const NOW = Date.parse("2026-11-03T08:00:00Z");
const clock = () => new Date(NOW - 60000);
const contract = () => newContract(repo, ["webxr", "web_app"], HEAD, clock);
const signal = () => ({
  repository: repo.full_name, repositoryId: repo.id,
  defaultBranch: "main", headSha: HEAD,
  observedAt: new Date(NOW - 120000).toISOString(),
  from: "LIVE_PUBLIC_GITHUB_API_READ_ONLY",
  functionallyVerified: false, mergeAuthorized: false
});

test("R8 handoff has immutable HEAD, all required checks and no run authority", () => {
  const json = prepareVerificationRequest(repo, contract(), signal(), NOW);
  assert(new TextEncoder().encode(json).length < MAX_VERIFY_REQUEST_BYTES);
  const x = JSON.parse(json);
  assert.equal(x.schema, VERIFY_REQUEST_SCHEMA);
  assert.equal(x.owner, "MichaelWave369");
  assert.equal(x.repository, repo.full_name);
  assert.equal(x.repository_id, 42);
  assert.equal(x.source_sha, HEAD);
  assert.equal(x.source_observed_utc, signal().observedAt);
  assert.equal(x.default_branch, "main");
  assert.equal(x.operator_notes_included, false);
  assert.equal(x.operator_review_required, true);
  assert.equal(x.independent_verification, "NOT_RUN");
  assert.equal(x.execution_state, "NOT_DISPATCHED");
  assert.equal(x.approved_for_execution, false);
  assert.equal(x.merge_authorized, false);
  assert.equal(x.job_dispatch_authorized, false);
  assert.equal(x.required_checks.filter(c => c.id === "production_build").length, 1);
});

test("personal operator notes remain local even if checklist was reviewed", () => {
  let c = updateContract(contract(), "headset_input", {
    locally_reviewed: true,
    note: "Sensitive review notes must not be uploaded. Local only."
  }, clock);
  const json = prepareVerificationRequest(repo, c, signal(), NOW);
  assert(!json.includes("Sensitive review notes"));
  assert(!json.includes('"note"'));
  assert.equal(JSON.parse(json).required_checks
    .find(x => x.id === "headset_input").locally_reviewed, true);
});

test("stale HEAD or changed commit cannot produce a request", () => {
  assert.throws(() => prepareVerificationRequest(repo, contract(),
    { ...signal(), headSha: OTHER }, NOW), /REQUEST_FRESH_HEAD_REQUIRED/);
  assert.throws(() => prepareVerificationRequest(repo, contract(),
    { ...signal(), observedAt: new Date(NOW - 16 * 60000).toISOString() }, NOW),
    /REQUEST_FRESH_HEAD_REQUIRED/);
  assert.throws(() => prepareVerificationRequest(repo, contract(),
    { ...signal(), observedAt: "not a date" }, NOW), /REQUEST_FRESH_HEAD_REQUIRED/);
  assert.throws(() => prepareVerificationRequest(repo, contract(),
    { ...signal(), from: "UNKNOWN_FEED" }, NOW), /REQUEST_FRESH_HEAD_REQUIRED/);
});

test("no catalog identity, private or curated demo cannot create an intake", () => {
  assert.throws(() => prepareVerificationRequest({ ...repo, exampleOnly: true },
    contract(), signal(), NOW), /REQUEST_PUBLIC_REPOSITORY_REQUIRED/);
  assert.throws(() => prepareVerificationRequest({ ...repo, full_name: "attacker/BTM" },
    contract(), signal(), NOW), /REQUEST_PUBLIC_REPOSITORY_REQUIRED/);
});

test("forged contract authority and injected check IDs fail closed", () => {
  const fake = { ...contract(), merge_authorized: true };
  assert.throws(() => prepareVerificationRequest(repo, fake, signal(), NOW),
    /REQUEST_CONTRACT_INVALID/);
  const edited = { ...contract(), checks: [...contract().checks] };
  edited.checks[0] = { id: "arbitrary_write", locally_reviewed: true, note: "" };
  assert.throws(() => prepareVerificationRequest(repo, edited, signal(), NOW),
    /REQUEST_CHECKS_INVALID/);
  const noSha = { ...contract(), source_sha: null };
  assert.throws(() => prepareVerificationRequest(repo, noSha, signal(), NOW),
    /REQUEST_CONTRACT_INVALID/);
});

test("false live signal authority and wrong repo ID do not export", () => {
  for (const change of [
    { functionallyVerified: true }, { mergeAuthorized: true },
    { repositoryId: 999 }, { repository: "MichaelWave369/Private" }
  ]) {
    assert.throws(() => prepareVerificationRequest(repo, contract(),
      { ...signal(), ...change }, NOW), /REQUEST_FRESH_HEAD_REQUIRED/);
  }
});

test("reasons remain actionable and do not print unknown error strings", () => {
  const m = verificationHandoffMessage(new Error("REQUEST_FRESH_HEAD_REQUIRED"));
  assert.match(m, /15 minutes/);
  assert(!verificationHandoffMessage(new Error("password=xyz")).includes("xyz"));
});
