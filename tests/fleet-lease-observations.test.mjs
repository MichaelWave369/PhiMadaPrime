import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLeaseObservations } from "../src/fleet-lease-observations.mjs";
const now = Date.parse("2026-11-07T20:00:00Z");
const observed_at = new Date(now - 120000).toISOString();
const row = {id:42,name:"BTM",full_name:"MichaelWave369/BTM",archived:false,exampleOnly:false};
function data(){
  return {
    schema:"agentora.fleet.steward-lease-observation.v0.3",
    owner:"MichaelWave369", scope:"public_only", source_scan_id:7,
    observed_at, status:"LOCAL_RESERVATIONS_NOT_RUNNING_AGENTS",
    reservations:[{github_id:42,repository:row.full_name,state:"RESERVED",
      generation:2,expires_ms:now+10000}],
    active_reservations:1, actual_jobs_dispatched:0,
    dispatch_authorized:false,merge_authorized:false,verified_complete:false
  };
}
function parse(sample,catalog=[row],time=now){
  return parseLeaseObservations(JSON.stringify(sample),catalog,time);
}
test("R3 import shows exclusive reservations not active software execution",()=>{
  const r=parse(data());
  assert.equal(r.currentlyReserved,1);
  assert.equal(r.reservations[0].repoName,"BTM");
  assert.equal(r.actualJobsDispatched,0);
  assert.equal(r.mergeAuthorized,false);
  assert.match(r.status,/NOT_EXECUTION/);
});
test("expired reservation stays historical not currently active",()=>{
  const r=parse(data(),[row],now+11000);
  assert.equal(r.currentlyReserved,0);
  assert.equal(r.reservations[0].state,"EXPIRED_SINCE_EXPORT");
});
test("forgery and private detail fail closed",()=>{
  for(const [key,val] of [
    ["dispatch_authorized",true],["merge_authorized",true],
    ["verified_complete",true],["actual_jobs_dispatched",1],
    ["owner","Another"],["private_repos",[]],["status","WORKING"]
  ]) assert.throws(()=>parse({...data(),[key]:val}),/HELD/);
  const s=data(); s.reservations[0].token="sensitive";
  assert.throws(()=>parse(s),/HELD/);
});
test("identity drift, duplicate IDs, stale observation and fake counts fail",()=>{
  const wrong=data();wrong.reservations[0].repository="MichaelWave369/NotBTM";
  assert.throws(()=>parse(wrong),/HELD/);
  const dup=data();dup.reservations.push({...dup.reservations[0]});dup.active_reservations=2;
  assert.throws(()=>parse(dup),/HELD/);
  const stale=data();stale.observed_at="2026-01-01T00:00:00Z";
  assert.throws(()=>parse(stale),/HELD/);
  const no=data();no.active_reservations=0;
  assert.throws(()=>parse(no),/HELD/);
  assert.throws(()=>parse(data(),[{...row,archived:true}]),/HELD/);
});
test("never contacts localhost or creates a GitHub write capability",()=>{
  const panel=readFileSync("src/reponerve.jsx","utf8");
  assert.match(panel,/parseLeaseObservations/);
  assert.doesNotMatch(panel,/fetch\(|127\.0\.0\.1|GITHUB_TOKEN|localStorage/i);
});
