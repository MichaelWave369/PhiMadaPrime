import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseStewardAdvisory } from "../src/steward-advisory.mjs";

const now = Date.parse("2026-11-07T19:00:00Z");
const observed_at = new Date(now - 60_000).toISOString();
const repo = {id:42, name:"BTM", full_name:"MichaelWave369/BTM", archived:false, exampleOnly:false};
const catalog = [repo];

function payload() {
  return {
    schema:"agentora.fleet.steward-advisory.v1", owner:"MichaelWave369",
    scope:"public_only", source:"AGENTORA_LOCAL_STEWARD_LEDGER",
    source_scan_id:7, observed_at,
    stewards:[{github_id:42,steward_key:"steward-gh-42",
      full_name:repo.full_name,state:"AVAILABLE",planned_count:2,last_rotation:2}],
    dispatch_authorized:false,merge_authorized:false,verified_complete:false
  };
}
function parse(x, rows=catalog) { return parseStewardAdvisory(JSON.stringify(x), rows, now); }

test("R2 logical stewards shown as planning data, never active agents", () => {
  const r = parse(payload());
  assert.equal(r.stewardCount,1);
  assert.equal(r.stewards[0].repoName,"BTM");
  assert.equal(r.stewards[0].plannedCount,2);
  assert.match(r.status,/NOT_RUNNING_AGENTS/);
  assert.equal(r.dispatchAuthorized,false);
  assert.equal(r.mergeAuthorized,false);
});
test("forged execution, private fields and unknown roots are held", () => {
  for(const [k,v] of [
    ["dispatch_authorized",true],["merge_authorized",true],["verified_complete",true],
    ["owner","Evil"],["private_rows",[]]
  ]) assert.throws(()=>parse({...payload(),[k]:v}),/HELD/);
  const x=payload(); x.stewards[0].private=false;
  assert.throws(()=>parse(x),/HELD/);
});
test("identity drift and foreign/catalog-absent stewards are refused", () => {
  const x=payload(); x.stewards[0].github_id=8;
  assert.throws(()=>parse(x),/HELD/);
  x.stewards[0].github_id=42; x.stewards[0].full_name="MichaelWave369/Different";
  assert.throws(()=>parse(x),/HELD/);
  assert.throws(()=>parse(payload(),[]),/HELD/);
  const twice=payload();twice.stewards.push({...twice.stewards[0]});
  assert.throws(()=>parse(twice),/HELD/);
});
test("archival mismatch, stale age, unsupported metadata cannot pass", () => {
  const x=payload();
  x.stewards[0].state="PAUSED_ARCHIVED";
  assert.throws(()=>parse(x),/HELD/);
  const stale=payload();stale.observed_at="2026-01-01T00:00:00Z";
  assert.throws(()=>parse(stale),/HELD/);
  const bad=payload(); bad.stewards[0].execution_state="RUNNING";
  assert.throws(()=>parse(bad),/HELD/);
});
test("viewer stays file-import-only and uses no local API",()=>{
  const src=readFileSync("src/reponerve.jsx","utf8");
  assert.match(src,/parseStewardAdvisory/);
  assert.match(src,/type="file"/);
  assert.doesNotMatch(src,/fetch\(|127\.0\.0\.1|GITHUB_TOKEN|localStorage/i);
});
