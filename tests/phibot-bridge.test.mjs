import test from "node:test";
import assert from "node:assert/strict";
import { QUEUE_SCHEMA,validateQueueExport,queueReviewText } from "../src/phibot-bridge.mjs";

const now=Date.parse("2026-11-05T02:00:00.000Z");
const t="2026-11-05T01:59:00.000Z";
const catalog=[{id:42,name:"Demo",full_name:"MichaelWave369/Demo",exampleOnly:false}];
function snapshot(){
 const jobs=[{id:"a".repeat(64),repository:"MichaelWave369/Demo",
  capability:"repo.steward.discover",state:"completed",
  attempts:1,updatedAt:t,outcome:"OBSERVED_NO_PROMOTION"}];
 return {schema:QUEUE_SCHEMA,producer:"MichaelWave369/phibot",
  classification:"LOCAL_OPERATOR_SELF_REPORT_NOT_ATTESTED",generatedAt:t,
  scope:{origin:"LOCAL_PERSISTED_READ_ONLY_QUEUE",
   runtimeWorkersVerified:false,modelRunsVerified:false,
   remoteWritesVerified:false,grantsIssued:false,
   completeFleetClaim:false,operatorDisclosureRequired:true},
  counts:{total:1,queued:0,leased:0,completed:1,exhausted:0},jobs};
}
test("R35 accepts real read-only queue snapshot only against public catalog",()=>{
 const report=validateQueueExport(snapshot(),catalog,now);
 assert.equal(report.importedLocally,true);
 assert.equal(report.verifiedRuntimeWorkers,0);
 assert.equal(report.independentAttestation,false);
 assert.equal(report.jobs[0].repository,catalog[0].full_name);
 assert.match(queueReviewText(report),/NOT proof of running models/);
});
test("R35 rejects arbitrary fields, falsely elevated claims and unknown source",()=>{
 const s=snapshot();
 assert.throws(()=>validateQueueExport({...s,token:"secret"},catalog,now),/SCHEMA_INVALID/);
 assert.throws(()=>validateQueueExport({...s,scope:{...s.scope,grantsIssued:true}},catalog,now),/SCOPE_INVALID/);
 assert.throws(()=>validateQueueExport({...s,producer:"AnotherService"},catalog,now),/SCHEMA_INVALID/);
 assert.throws(()=>validateQueueExport({...s,counts:{...s.counts,completed:0}},catalog,now),/COUNTS_MISMATCH/);
});
test("R35 rejects tampered jobs and unsupported capability or states",()=>{
 const s=snapshot();
 for(const job of [
  {...s.jobs[0],id:"oops"},
  {...s.jobs[0],capability:"repo.steward.draft"},
  {...s.jobs[0],state:"running"},
  {...s.jobs[0],ownerSecret:"x"},
  {...s.jobs[0],outcome:"AUTO_MERGED"}
 ]){
  assert.throws(()=>validateQueueExport({...s,jobs:[job]},catalog,now),/JOB_INVALID/);
 }
});
test("R35 rejects private/unverified catalog entries before displaying names",()=>{
 const s=snapshot();
 assert.throws(()=>validateQueueExport(s,[],now),/REPOSITORY_NOT_IN_PUBLIC_CATALOG/);
 assert.throws(()=>validateQueueExport(s,[{...catalog[0],exampleOnly:true}],now),
  /REPOSITORY_NOT_IN_PUBLIC_CATALOG/);
 assert.throws(()=>validateQueueExport({...s,jobs:[{...s.jobs[0],repository:"MichaelWave369/Private"}]},
  catalog,now),/REPOSITORY_NOT_IN_PUBLIC_CATALOG/);
});
test("R35 rejects stale, future, oversized, duplicate and inconsistent records",()=>{
 const s=snapshot();
 assert.throws(()=>validateQueueExport(s,catalog,now+86400000+60000),/STALE_OR_FUTURE/);
 assert.throws(()=>validateQueueExport(s,catalog,now-600000),/STALE_OR_FUTURE/);
 assert.throws(()=>validateQueueExport({...s,jobs:Array(101).fill(s.jobs[0])},catalog,now),/BOUNDS_INVALID/);
 assert.throws(()=>validateQueueExport({...s,jobs:[s.jobs[0],s.jobs[0]],
  counts:{total:2,queued:0,leased:0,completed:2,exhausted:0}},catalog,now),/JOB_INVALID/);
 assert.throws(()=>validateQueueExport({...s,generatedAt:"not-a-date"},catalog,now),/TIME_INVALID/);
});
test("R35 allows an empty queue and refuses untrusted handoff claims",()=>{
 const s=snapshot();
 const empty=validateQueueExport({...s,jobs:[],counts:{
  total:0,queued:0,leased:0,completed:0,exhausted:0}},catalog,now);
 assert.equal(empty.counts.total,0);
 assert.throws(()=>queueReviewText({...empty,grantAuthority:true}),/UNTRUSTED_REVIEW/);
});
