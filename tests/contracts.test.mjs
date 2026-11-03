import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_SCHEMA, CONTRACT_TYPES, CHECK_LABELS, newContract, updateContract,
  rebaseContract, observedSourceSha, contractProgress,
  serializeContracts, parseContracts, selectSurfaces
} from "../src/contracts.mjs";

const repo = {
  id: 42, name: "BTM", full_name: "MichaelWave369/BTM",
  exampleOnly: false
};
const other = {
  id: 43, name: "Agentora", full_name: "MichaelWave369/Agentora",
  exampleOnly: false
};
const SHA = "a".repeat(40), NEXT = "b".repeat(40);
const now = () => new Date("2026-11-03T07:30:00Z");

test("nine project surfaces plus manual scoping, none inherently require React", () => {
  assert(Object.hasOwn(CONTRACT_TYPES, "webxr"));
  assert(Object.hasOwn(CONTRACT_TYPES, "research"));
  assert(Object.hasOwn(CONTRACT_TYPES, "android"));
  assert(Object.hasOwn(CONTRACT_TYPES, "os_image"));
  assert(!CONTRACT_TYPES.research.checks.includes("deployed_revision"));
  assert(!CONTRACT_TYPES.python_package.checks.includes("deployed_revision"));
  assert(!CONTRACT_TYPES.webxr.checks.includes("package_build"));
  assert(Object.values(CONTRACT_TYPES).every(t => t.checks.every(id => CHECK_LABELS[id])));
});

test("unclassified repos start with human surface confirmation", () => {
  const c = newContract(repo, ["manual_review"], null, now);
  assert.equal(c.checks.length, 1);
  assert.equal(c.checks[0].id, "scope_and_surface_classification");
  assert.equal(c.operator_only, true);
  assert.equal(c.independently_verified, false);
  assert.equal(c.certified_complete, false);
  assert.equal(c.merge_authorized, false);
  assert.equal(c.job_dispatch_authorized, false);
  assert.equal(contractProgress(c, null).sourceState, "HEAD_NOT_CONFIRMED");
});

test("multi-surface contracts are deterministically deduplicated", () => {
  const c = newContract(repo, ["web_app", "webxr"], SHA, now);
  assert.equal(c.checks.filter(x => x.id === "production_build").length, 1);
  assert(c.checks.some(x => x.id === "headset_input"));
  assert(c.checks.some(x => x.id === "deployed_revision"));
  assert(c.checks.every(x => !x.locally_reviewed && x.note === ""));
});

test("locally reviewed notes never become independent proof", () => {
  let c = newContract(repo, ["research"], SHA, now);
  for (const check of c.checks) {
    c = updateContract(c, check.id, {
      locally_reviewed: true, note: "Human reviewed supporting material"
    }, now);
  }
  assert.equal(contractProgress(c, SHA).locallyReviewed, c.checks.length);
  assert.equal(contractProgress(c, SHA).evidenceVerified, 0);
  assert.equal(contractProgress(c, SHA).certifiedComplete, false);
  assert.equal(contractProgress(c, SHA).dispatchable, false);
  assert(!c.independently_verified && !c.certified_complete);
});

test("changed observed source is flagged, rebind clears review checkboxes", () => {
  let c = newContract(repo, ["webxr"], SHA, now);
  c = updateContract(c, "headset_input", { locally_reviewed: true, note: "Test old build" }, now);
  assert.equal(contractProgress(c, NEXT).sourceState, "SOURCE_CHANGED");
  const rebase = rebaseContract(c, NEXT, now);
  assert.equal(contractProgress(rebase, NEXT).sourceState, "OBSERVED_SHA_MATCH");
  assert(rebase.checks.every(x => x.locally_reviewed === false));
  assert.equal(rebase.checks.find(x => x.id === "headset_input").note, "Test old build");
});

test("unsupported surfaces, bogus checks and oversized notes cannot be added", () => {
  assert.throws(() => selectSurfaces(["__proto__"]), /CONTRACT_TYPES_INVALID/);
  assert.throws(() => selectSurfaces(["webxr", "webxr"]), /CONTRACT_TYPES_INVALID/);
  assert.throws(() => newContract({ ...repo, exampleOnly: true }, ["webxr"], SHA), /PUBLIC_REPO_REQUIRED/);
  assert.throws(() => newContract({ ...repo, full_name: "attacker/BTM" },
    ["webxr"], SHA), /PUBLIC_REPO_REQUIRED/);
  assert.throws(() => newContract(repo, ["webxr"], "not a sha"), /CONTRACT_SHA_INVALID/);
  const c = newContract(repo, ["webxr"], SHA, now);
  assert.throws(() => updateContract(c, "not_a_check", { note: "x" }), /CONTRACT_CHECK_UNKNOWN/);
  assert.throws(() => updateContract(c, c.checks[0].id,
    { note: "x".repeat(501) }), /CONTRACT_CHECK_VALUE_INVALID/);
  assert.throws(() => updateContract(c, c.checks[0].id,
    { certified_complete: true }), /CONTRACT_PATCH_INVALID/);
});

test("local export/import roundtrip retains notes but no authorization", () => {
  const first = updateContract(newContract(repo, ["webxr"], SHA, now),
    "headset_input", { locally_reviewed: true, note: "Quest 3 check pending" }, now);
  const second = newContract(other, ["node_service"], null, now);
  const raw = serializeContracts({ [repo.id]: first, [other.id]: second },
    [repo, other], now);
  const bundle = JSON.parse(raw);
  assert.equal(bundle.schema, CONTRACT_SCHEMA);
  assert.equal(bundle.certified_complete_count, 0);
  assert.equal(bundle.job_dispatch_authorized, false);
  const parsed = parseContracts(raw, [repo, other]);
  assert.equal(Object.keys(parsed).length, 2);
  assert.equal(parsed[42].checks.find(x => x.id === "headset_input").note,
    "Quest 3 check pending");
  assert.equal(parsed[43].source_sha, null);
});

test("private or vanished repos are rejected on import instead of silently leaking", () => {
  const raw = serializeContracts({ 42: newContract(repo, ["webxr"], SHA, now) }, [repo], now);
  assert.throws(() => parseContracts(raw, []), /CONTRACT_PUBLIC_REPO_MISMATCH/);
  assert.throws(() => parseContracts(raw, [{ ...repo, id: 42, exampleOnly: true }]),
    /CONTRACT_PUBLIC_REPO_MISMATCH/);
});

test("tampered completion and merge claims cannot be imported", () => {
  const bundle = JSON.parse(serializeContracts(
    { 42: newContract(repo, ["webxr"], SHA, now) }, [repo], now));
  bundle.contracts[0].certified_complete = true;
  assert.throws(() => parseContracts(JSON.stringify(bundle), [repo]),
    /CONTRACT_AUTHORITY_REJECTED/);
  bundle.contracts[0].certified_complete = false;
  bundle.merge_authorized = true;
  assert.throws(() => parseContracts(JSON.stringify(bundle), [repo]),
    /CONTRACT_BUNDLE_INVALID/);
  bundle.merge_authorized = false;
  bundle.contracts[0].checks.push({
    id: "merge", note: "approved", locally_reviewed: true
  });
  assert.throws(() => parseContracts(JSON.stringify(bundle), [repo]),
    /CONTRACT_CHECKS_INVALID/);
});

test("source candidate prefers fresh directly observed CI HEAD, then cohort", () => {
  const fresh = { headSha: SHA, observedAt: new Date().toISOString() };
  const cohort = { state: "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED", sourceSha: NEXT };
  const plan = { completion: "UNVERIFIED", head_sha: NEXT };
  assert.equal(observedSourceSha(fresh, cohort, plan), SHA);
  assert.equal(observedSourceSha({ headSha: SHA, observedAt: "2000-01-01T00:00:00Z" },
    cohort, plan), NEXT);
  assert.equal(observedSourceSha(null, { state: "STALE_AFTER_PUSH", sourceSha: SHA },
    { completion: "NOT_AUDITED", head_sha: NEXT }), null);
  assert.equal(observedSourceSha(null, null, plan), NEXT);
});
