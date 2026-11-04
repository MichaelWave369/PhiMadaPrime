import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { completionLane } from "../src/completion-lane.mjs";
import { newContract, updateContract } from "../src/contracts.mjs";
import { prepareVerificationRequest } from "../src/verification-request.mjs";

const NOW=Date.parse("2026-11-04T05:25:00.000Z");
const OLD="a".repeat(40),HEAD="b".repeat(40);
const repo={id:7331,name:"BTM",full_name:"MichaelWave369/BTM",
  exampleOnly:false,description:"Retro FPS"};
const signal=(patch={})=>({
  from:"LIVE_PUBLIC_GITHUB_API_READ_ONLY",
  repository:repo.full_name,repositoryId:repo.id,
  headSha:HEAD,defaultBranch:"main",
  observedAt:new Date(NOW-20000).toISOString(),
  functionallyVerified:false,mergeAuthorized:false,
  ci:{state:"OBSERVED_GREEN_AT_HEAD"},openPrs:[],...patch
});
const contract=(sha=HEAD)=>newContract(repo,["webxr"],sha,()=>new Date(NOW-30000));

test("R26-01 no selected repo means no assumed project, work or authorization",()=>{
  const r=completionLane(null,null,null,NOW);
  assert.equal(r.stage,"SELECT_REPO");
  assert.equal(r.repository,null);
  assert.equal(r.readyToExport,false);
  assert.equal(r.productComplete,false);
  assert.equal(r.dispatchAuthorized,false);
  assert.equal(r.mergeAuthorized,false);
});
test("R26-02 reject private/examples/mismatched owner and forged numeric IDs",()=>{
  for(const changed of [
    {exampleOnly:true},{id:-1},{id:0},{id:"7331"},
    {name:"../../bad"},{full_name:"attacker/BTM"},
    {full_name:"MichaelWave369/PhiOS"}
  ]) {
    const r=completionLane({...repo,...changed},signal(),contract(),NOW);
    assert.equal(r.stage,"CATALOG_UNAVAILABLE",JSON.stringify(changed));
    assert.equal(r.readyToExport,false);
  }
});
test("R26-03 no live inspection remains a blocker even with locally ticked contract",()=>{
  const r=completionLane(repo,null,contract(),NOW);
  assert.equal(r.stage,"HEAD_INSPECTION_REQUIRED");
  assert.equal(r.readyToExport,false);
  assert.equal(r.independentlyVerifiedChecks,0);
});
test("R26-04 reject expired, future-dated, wrong-repo or untrusted live signals",()=>{
  for(const changed of [
    {observedAt:new Date(NOW-16*60000).toISOString()},
    {observedAt:new Date(NOW+6*60000).toISOString()},
    {observedAt:"not a time"},
    {repository:"MichaelWave369/PhiOS"},{repositoryId:999},
    {from:"SIMULATED"},{headSha:"main"},
    {mergeAuthorized:true},{functionallyVerified:true}
  ]) {
    const r=completionLane(repo,signal(changed),contract(),NOW);
    assert.equal(r.stage,"HEAD_INSPECTION_REQUIRED",JSON.stringify(changed));
    assert.equal(r.readyToExport,false);
  }
});
test("R26-05 current inspected head without contract still blocks exporter",()=>{
  const r=completionLane(repo,signal(),null,NOW);
  assert.equal(r.stage,"CONTRACT_REQUIRED");
  assert.equal(r.observedHeadSha,HEAD);
  assert.equal(r.contractSha,null);
});
test("R26-06 source drift blocks requests even when all local checkboxes are ticked",()=>{
  let c=contract(OLD);
  for(const check of c.checks) c=updateContract(c,check.id,
    {locally_reviewed:true},()=>new Date(NOW-20000));
  const r=completionLane(repo,signal(),c,NOW);
  assert.equal(r.stage,"SOURCE_MOVED_REBIND");
  assert.equal(r.locallyReviewed,c.checks.length);
  assert.equal(r.readyToExport,false);
  assert.equal(r.contractSha,OLD);
  assert.equal(r.observedHeadSha,HEAD);
});
test("R26-07 reject invalid or oversized/malformed contract before progress calculation",()=>{
  for(const c of [
    {...contract(),checks:null},
    {...contract(),checks:{}},
    {...contract(),checks:Array(101).fill({id:"automated_tests"})},
    {...contract(),checks:[null]}
  ]) {
    const r=completionLane(repo,signal(),c,NOW);
    assert.equal(r.stage,"CONTRACT_REVIEW_REQUIRED");
    assert.equal(r.readyToExport,false);
  }
});
test("R26-08 foreign repo contract and forged authority can never become a request",()=>{
  for(const changed of [
    {repository:"MichaelWave369/Agentora"},
    {repository_id:888},
    {operator_only:false},
    {certified_complete:true},
    {merge_authorized:true},
    {job_dispatch_authorized:true},
    {independently_verified:true}
  ]) {
    const r=completionLane(repo,signal(),{...contract(),...changed},NOW);
    assert.equal(r.stage,"CONTRACT_REVIEW_REQUIRED",JSON.stringify(changed));
    assert.equal(r.readyToExport,false);
    assert.equal(r.mergeAuthorized,false);
  }
});
test("R26-09 exact current HEAD and valid scoped contract enable ONLY local request export",()=>{
  const c=contract();
  const r=completionLane(repo,signal(),c,NOW);
  assert.equal(r.stage,"REQUEST_READY_FOR_LOCAL_EXPORT");
  assert.equal(r.readyToExport,true);
  assert.equal(r.sourceMatches,true);
  assert.equal(r.requiredChecks,c.checks.length);
  assert.equal(r.locallyReviewed,0);
  assert.equal(r.independentlyVerifiedChecks,0);
  assert.equal(r.verificationExecuted,false);
  assert.equal(r.productComplete,false);
  assert.equal(r.mergeAuthorized,false);
  assert.equal(r.dispatchAuthorized,false);
});
test("R26-10 compatible exact-SHA export remains R8 request, with no execution rights",()=>{
  const raw=prepareVerificationRequest(repo,contract(),signal(),NOW);
  const data=JSON.parse(raw);
  assert.equal(data.schema,"phimada.verification-request.v0.8");
  assert.equal(data.repository,repo.full_name);
  assert.equal(data.source_sha,HEAD);
  assert.equal(data.execution_state,"NOT_DISPATCHED");
  assert.equal(data.approved_for_execution,false);
  assert.equal(data.independent_verification,"NOT_RUN");
  assert.equal(data.merge_authorized,false);
  assert.equal(data.job_dispatch_authorized,false);
});
test("R26-11 missing, malformed or duplicate surface checks must fail through real R8 serializer",()=>{
  const good=contract();
  for(const changed of [
    {checks:good.checks.slice(1)},
    {surface_types:["webxr","webxr"]},
    {checks:good.checks.map((check,i)=>i===0?{id:check.id,locally_reviewed:"yes"}:check)}
  ]) {
    const r=completionLane(repo,signal(),{...good,...changed},NOW);
    assert.equal(r.readyToExport,false);
  }
});
test("R26-12 Mission Board visibly hosts full-fleet lane BEFORE nested evidence bay",()=>{
  const board=readFileSync("src/mission-board.jsx","utf8");
  assert.match(board,/import \{ OneRepoCompletionLane \} from "\.\/completion-lane\.jsx"/);
  const lane=board.indexOf("<OneRepoCompletionLane");
  const evidence=board.indexOf("<EvidenceBay");
  const pilotEmpty=board.indexOf("{!plan ?");
  assert.ok(lane>0&&lane<evidence&&evidence<pilotEmpty);
  assert.match(board,/onExportVerification=\{onExportVerification\}/);
  const laneSource=readFileSync("src/completion-lane.jsx","utf8");
  assert.match(laneSource,/No Agentora pilot plan is required/);
});
test("R26-13 UI explicitly prevents starting work and uses disabled export",()=>{
  const src=readFileSync("src/completion-lane.jsx","utf8");
  assert.match(src,/disabled=\{!ready\|\|!onExportVerification\}/);
  assert.match(src,/const ready=status\.readyToExport && !error && !loading/);
  assert.match(src,/NO AUTO DISPATCH/);
  assert.match(src,/No project is marked complete/);
  assert.match(src,/onExportVerification\(selected\.id\)/);
  assert.doesNotMatch(src,/\bfetch\s*\(|\bpostMessage\s*\(/);
});
test("R26-14 source-bound existing export action is reused, not a fake result generator",()=>{
  const app=readFileSync("src/main.jsx","utf8");
  assert.match(app,/onExportVerification=\{repoId => \{/);
  assert.match(app,/if \(repo\) downloadVerificationRequest\(repo\)/);
  assert.match(app,/prepareVerificationRequest\(\s*repo, contracts\[repo\.id\], signals\[repo\.id\]\)/);
  const helper=readFileSync("src/completion-lane.mjs","utf8");
  assert.match(helper,/prepareVerificationRequest\(repo,contract,signal,now\)/);
  assert.doesNotMatch(helper,/\bfetch\s*\(|\bdispatch\s*\(|\bmerge\s*\(/);
});
test("R26-15 no need for a mission proposal and finite selectable results",()=>{
  const src=readFileSync("src/completion-lane.jsx","utf8");
  assert.match(src,/catalog\.filter\(row=>row && !row\.exampleOnly/);
  assert.match(src,/const options=matched\.slice\(0,30\)/);
  assert.match(src,/const selected=repos\.find/);
  assert.match(src,/Find a repository/);
  assert.match(src,/Current project/);
  assert.doesNotMatch(src,/\bmissionQueue\s*\(|\bplan=\{|\bqueue=\{/);
});
