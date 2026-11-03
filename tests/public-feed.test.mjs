import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { fetchPublicSnapshot, sha256Hex, validatePublicManifest } from "../src/public-feed.mjs";

const OWNER = "MichaelWave369";
const SHA = "a".repeat(40);
const repo = { id: 17, name: "Agentora", full_name: OWNER + "/Agentora",
  exampleOnly: false };
const rows = [repo];

async function fixture() {
  const now = Date.now();
  const auditTime = new Date(now - 90_000).toISOString();
  const planTime = new Date(now - 30_000).toISOString();
  const audit = {
    schema: "agentora.fleet.audit.v0.1", owner: OWNER, generated_utc: auditTime,
    private_included: false, merge_authorized: false, job_dispatch_authorized: false,
    repository_count: 1, deep_audited_count: 1, scope: "pilot",
    repositories: [{
      repository: repo.full_name, repository_id: repo.id, visibility: "public",
      completion: "UNVERIFIED", head_sha: SHA,
      ci: "OBSERVED_RUNS_GREEN_AT_HEAD_NOT_BUILD_PROOF",
      pages: "NOT_VERIFIED", release: "NOT_VERIFIED"
    }]
  };
  const plan = {
    schema: "agentora.fleet.plan.v0.2", owner: OWNER, generated_utc: planTime,
    source_audit_utc: auditTime, public_output: true, merge_authorized: false,
    job_dispatch_authorized: false, operator_review_required: true,
    verified_complete_count: 0, inventory_count: 1, deep_audited_count: 1,
    profiles: [{
      repository: repo.full_name, completion: "UNVERIFIED",
      operator_review_required: true, head_sha: SHA,
      surface_candidates: ["web_app"],
      observations: { ci: "NOT_VERIFIED", pages: "NOT_VERIFIED", release: "NOT_VERIFIED" }
    }],
    tasks: [{
      repository: repo.full_name, state: "REVIEW_ONLY_NOT_DISPATCHABLE",
      summary: "Verify exact-commit build", check_id: "build", head_sha: SHA, priority: 96
    }]
  };
  const auditRaw = JSON.stringify(audit), planRaw = JSON.stringify(plan);
  const manifest = {
    schema: "phimada.public-fleet.v0.1", owner: OWNER, scope: "pilot",
    public_only: true, status: "OBSERVATIONS_ONLY_NOT_PRODUCT_VERIFICATION",
    generated_utc: planTime, inventory_count: 1, deep_audited_count: 1,
    review_only_tasks: 1, verified_complete_count: 0,
    merge_authorized: false, job_dispatch_authorized: false,
    agentora_commit_sha: SHA,
    files: {
      audit: { path: "fleet-audit.json", size: auditRaw.length,
        sha256: await sha256Hex(auditRaw, webcrypto) },
      plan: { path: "fleet-plan.json", size: planRaw.length,
        sha256: await sha256Hex(planRaw, webcrypto) }
    }
  };
  const resources = {
    "./fleet/manifest.json": JSON.stringify(manifest),
    "./fleet/fleet-audit.json": auditRaw,
    "./fleet/fleet-plan.json": planRaw
  };
  const calls = [];
  const fetcher = async (path, opts) => {
    calls.push({ path, opts });
    if (!(path in resources)) throw new Error("unexpected network path");
    return { ok: true, text: async () => resources[path],
      headers: { get: () => null } };
  };
  return { now, manifest, audit, plan, resources, calls, fetcher };
}

test("public Pages snapshot with hashes imports as review-only Agentora evidence", async () => {
  const sample = await fixture();
  const loaded = await fetchPublicSnapshot(rows, sample.fetcher,
    { now: sample.now, cryptoApi: webcrypto });
  assert.equal(loaded.manifest.scope, "pilot");
  assert.equal(loaded.audit.source, "PUBLIC_PAGES_PILOT");
  assert.equal(loaded.plan.source, "PUBLIC_PAGES_PILOT");
  assert.equal(loaded.plan.priorityQueue.length, 1);
  assert.equal(loaded.plan.byRepo.Agentora.completion, "UNVERIFIED");
  assert.equal(loaded.manifest.verified_complete_count, 0);
  assert.equal(sample.calls.length, 3);
  assert(sample.calls.every(x => x.path.startsWith("./fleet/")));
  assert(sample.calls.every(x => x.opts.credentials === "omit"));
});

test("public feed does not load absent live GitHub catalog", async () => {
  const sample = await fixture();
  await assert.rejects(fetchPublicSnapshot([], sample.fetcher,
    { cryptoApi: webcrypto }), /PUBLIC_CATALOG_REQUIRED/);
  assert.equal(sample.calls.length, 0);
});

test("stale snapshot or false completion cannot pass manifest gate", async () => {
  const sample = await fixture();
  assert.throws(() => validatePublicManifest({
    ...sample.manifest, generated_utc: new Date(sample.now - 31 * 3600_000).toISOString()
  }, sample.now), /PUBLIC_FEED_STALE/);
  assert.throws(() => validatePublicManifest({
    ...sample.manifest, verified_complete_count: 1
  }, sample.now), /PUBLIC_FEED_MANIFEST_INVALID/);
  assert.throws(() => validatePublicManifest({
    ...sample.manifest, scope: "all"
  }, sample.now), /PUBLIC_FEED_MANIFEST_INVALID/);
});

test("content tampering and untrusted private repos are refused", async () => {
  const sample = await fixture();
  sample.resources["./fleet/fleet-plan.json"] += " ";
  await assert.rejects(fetchPublicSnapshot(rows, sample.fetcher,
    { now: sample.now, cryptoApi: webcrypto }), /PUBLIC_FEED_INTEGRITY_MISMATCH/);

  const privateSample = await fixture();
  privateSample.audit.repositories[0].visibility = "private";
  privateSample.resources["./fleet/fleet-audit.json"] = JSON.stringify(privateSample.audit);
  privateSample.manifest.files.audit = {
    ...privateSample.manifest.files.audit,
    sha256: await sha256Hex(privateSample.resources["./fleet/fleet-audit.json"], webcrypto),
    size: privateSample.resources["./fleet/fleet-audit.json"].length
  };
  privateSample.resources["./fleet/manifest.json"] = JSON.stringify(privateSample.manifest);
  await assert.rejects(fetchPublicSnapshot(rows, privateSample.fetcher,
    { now: privateSample.now, cryptoApi: webcrypto }), /PRIVATE_ROW_REJECTED/);
});

test("incomplete provenance, forged tasks and non-HTTPS redirect not accepted", async () => {
  const sample = await fixture();
  sample.plan.tasks[0].state = "DISPATCHABLE";
  sample.resources["./fleet/fleet-plan.json"] = JSON.stringify(sample.plan);
  sample.manifest.files.plan = {
    ...sample.manifest.files.plan,
    sha256: await sha256Hex(sample.resources["./fleet/fleet-plan.json"], webcrypto),
    size: sample.resources["./fleet/fleet-plan.json"].length
  };
  sample.resources["./fleet/manifest.json"] = JSON.stringify(sample.manifest);
  await assert.rejects(fetchPublicSnapshot(rows, sample.fetcher,
    { now: sample.now, cryptoApi: webcrypto }), /DISPATCH_CLAIM_REJECTED/);
});

test("refuse missing digest capability instead of silently trusting unverified bytes", async () => {
  const sample = await fixture();
  await assert.rejects(fetchPublicSnapshot(rows, sample.fetcher,
    { now: sample.now, cryptoApi: {} }), /PUBLIC_FEED_INTEGRITY_UNAVAILABLE/);
});
