import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { parsePublicCoverage, fetchPublicCoverage } from "../src/coverage.mjs";
import { sha256Hex } from "../src/public-feed.mjs";

const owner = "MichaelWave369";
const pinned = "502115508421eb1c98a6c05a79d04a9e432b8b27";
const SHA = "a".repeat(40);
const rows = Array.from({ length: 4 }, (_, i) => ({
  name: "Repo" + i, id: i + 1,
  full_name: owner + "/Repo" + i, exampleOnly: false,
  pushed_at: "2026-11-01T12:00:00Z"
}));

async function sample(now = Date.now()) {
  const at = new Date(now - 60_000).toISOString();
  const records = rows.map((r, i) => ({
    repository: r.full_name, repository_id: r.id,
    pushed_at: r.pushed_at,
    observed_at: i === 0 ? at : null,
    observed_pushed_at: i === 0 ? r.pushed_at : null,
    head_sha: i === 0 ? SHA : null,
    ci: i === 0 ? "OBSERVED_RUNS_GREEN_AT_HEAD_NOT_BUILD_PROOF" : "NOT_VERIFIED",
    pages: "NOT_VERIFIED", release: "NOT_VERIFIED",
    observation_limitations: [],
    evidence_state: i === 0 ? "RECENT_OBSERVATION_NOT_PRODUCT_VERIFIED" : "NEVER_OBSERVED"
  }));
  const payload = {
    schema: "phimada.public-coverage.v0.1",
    owner, source_commit_sha: pinned, public_only: true,
    merge_authorized: false, job_dispatch_authorized: false,
    generated_utc: at, inventory_count: 4, cohort_size: 1,
    observed_ever: 1, recent_clean_observations: 1,
    recent_limited_observations: 0, never_observed: 3,
    stale_or_changed: 0, verified_complete_count: 0,
    records
  };
  const raw = JSON.stringify(payload);
  const manifest = {
    schema: "phimada.public-fleet.v0.1",
    owner, scope: "pilot", public_only: true,
    merge_authorized: false, job_dispatch_authorized: false,
    agentora_commit_sha: pinned, inventory_count: 4,
    files: { coverage: {
      path: "coverage.json", size: new TextEncoder().encode(raw).length,
      sha256: await sha256Hex(raw, webcrypto)
    }},
    coverage: { generated_utc: at, observed_ever: 1,
      recent_clean_observations: 1, never_observed: 3, cohort_size: 1 }
  };
  const calls = [];
  const fetcher = async (url, args) => {
    calls.push({ url, args });
    return { ok: true, text: async () => raw, headers: { get: () => null } };
  };
  return { payload, raw, manifest, calls, fetcher, now };
}

test("coverage report distinguishes observed from never, not functional completion", async () => {
  const x = await sample();
  const parsed = parsePublicCoverage(x.raw, x.manifest, rows, x.now);
  assert.equal(parsed.stats.inventory, 4);
  assert.equal(parsed.stats.observed, 1);
  assert.equal(parsed.stats.never, 3);
  assert.equal(parsed.stats.recentClean, 1);
  assert.equal(parsed.stats.verifiedComplete, 0);
  assert.equal(parsed.byRepo.Repo0.completed, false);
  assert.match(parsed.byRepo.Repo0.ci, /NOT_BUILD_PROOF/);
});

test("coverage fetch remains same-origin with no credentials and SHA256 verification", async () => {
  const x = await sample();
  const actual = await fetchPublicCoverage(rows, x.manifest, x.fetcher,
    { now: x.now, cryptoApi: webcrypto });
  assert.equal(actual.stats.observed, 1);
  assert.deepEqual(x.calls.map(c => c.url), ["./fleet/coverage.json"]);
  assert.equal(x.calls[0].args.credentials, "omit");
  assert.equal(x.calls[0].args.redirect, "error");
});

test("byte tampering fails integrity validation", async () => {
  const x = await sample();
  const tampered = async () => ({ ok: true,
    text: async () => x.raw + " ",
    headers: { get: () => null } });
  await assert.rejects(fetchPublicCoverage(rows, x.manifest, tampered,
    { now: x.now, cryptoApi: webcrypto }), /COVERAGE_SIZE_MISMATCH/);
});

test("private or mismatched authority is rejected instead of being shown", async () => {
  const x = await sample();
  x.payload.merge_authorized = true;
  assert.throws(() => parsePublicCoverage(JSON.stringify(x.payload),
    x.manifest, rows, x.now), /SCHEMA_OR_COUNTS/);
  const y = await sample();
  y.payload.records[1].repository = "SomeoneElse/Private";
  assert.throws(() => parsePublicCoverage(JSON.stringify(y.payload),
    y.manifest, rows, y.now), /COVERAGE_ROW_INVALID/);
});

test("older published snapshots cannot masquerade as current observations", async () => {
  const x = await sample();
  const now = x.now + 31 * 3600_000;
  assert.throws(() => parsePublicCoverage(x.raw, x.manifest, rows, now),
    /COVERAGE_SNAPSHOT_STALE/);
});

test("unknown former public repo is not included in current public displayed catalog", async () => {
  const x = await sample();
  const current = rows.slice(1);
  const parsed = parsePublicCoverage(x.raw, x.manifest, current, x.now);
  assert.equal(parsed.stats.inventory, 3);
  assert.equal(parsed.stats.observed, 0);
  assert.equal(parsed.stats.never, 3);
  assert.equal(parsed.byRepo.Repo0, undefined);
});

test("duplicate repo records and forged progress totals fail", async () => {
  const x = await sample();
  x.payload.records[2].repository = x.payload.records[1].repository;
  assert.throws(() => parsePublicCoverage(JSON.stringify(x.payload),
    x.manifest, rows, x.now), /COVERAGE_DUPLICATE/);
  const y = await sample();
  y.payload.observed_ever = 4;
  assert.throws(() => parsePublicCoverage(JSON.stringify(y.payload),
    y.manifest, rows, y.now), /COVERAGE_TOTALS_INVALID/);
});
