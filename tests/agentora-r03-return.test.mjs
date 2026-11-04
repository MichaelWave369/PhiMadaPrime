import test from "node:test";
import assert from "node:assert/strict";
import { createHash,webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { newContract } from "../src/contracts.mjs";
import { prepareVerificationRequest } from "../src/verification-request.mjs";
import { reviewAgentoraR03,recheckR03Context,
  R03_MAX_REQUEST_BYTES,R03_MAX_RECEIPT_BYTES
} from "../src/agentora-r03-return.mjs";

const NOW=Date.parse("2026-11-04T06:00:00.000Z");
const SHA="a".repeat(40),MOVED="b".repeat(40);
const repo={id:1443845098,name:"PhiMadaPrime",
  full_name:"MichaelWave369/PhiMadaPrime",exampleOnly:false};
const contract=()=>newContract(repo,["web_app"],SHA,()=>new Date(NOW-60000));
const signal=(patch={})=>({
  from:"LIVE_PUBLIC_GITHUB_API_READ_ONLY",
  repository:repo.full_name,repositoryId:repo.id,
  defaultBranch:"main",headSha:SHA,
  observedAt:new Date(NOW-20000).toISOString(),
  functionallyVerified:false,mergeAuthorized:false,...patch
});
const encoder=new TextEncoder();
const manual=new Set([
  "browser_interaction","accessibility","headset_input","comfort_acceptance",
  "navigation","clean_install_import","recovery_rollback","device_smoke",
  "clean_install_launch","vm_boot","hardware_acceptance","methodology",
  "reproducible_results","negative_controls","limitations_review",
  "scope_and_surface_classification","deployed_revision","versioned_artifact"
]);
function fixture() {
  const c=contract(),s=signal();
  const raw=prepareVerificationRequest(repo,c,s,NOW);
  const request=JSON.parse(raw);
  const receipt={
    schema:"agentora.fleet.verification-intake.v0.3",
    state:"HELD_FOR_OPERATOR_REVIEW",owner:"MichaelWave369",
    repository:request.repository,repository_id:request.repository_id,
    default_branch:request.default_branch,source_sha:request.source_sha,
    source_observed_utc:request.source_observed_utc,
    prepared_utc:request.prepared_utc,
    received_utc:new Date(NOW+10000).toISOString(),
    request_sha256:createHash("sha256").update(encoder.encode(raw)).digest("hex"),
    digest_is_authentication:false,
    surface_types:[...request.surface_types],
    checks:request.required_checks.map(item=>({
      check_id:item.id,operator_reviewed_claim:item.locally_reviewed,
      lane:manual.has(item.id)?"HUMAN_OR_DEVICE_REQUIRED":"AUTOMATION_CANDIDATE_ONLY",
      verification_state:"NOT_RUN",evidence_receipt:null
    })),
    head_revalidated_by_agentora:false,independent_checks_run:0,
    verified_complete:false,operator_approved:false,
    dispatch_authorized:false,merge_authorized:false,
    next_steps:Array.from({length:6},(_,i)=>"Human review step "+(i+1))
  };
  return {request,raw,receipt,c,s};
}
async function review(f,{request=f.request,receipt=f.receipt,raw,repoOverride=repo,
  contractOverride=f.c,signalOverride=f.s,now=NOW+20000}={}){
  const requestBytes=encoder.encode(raw===undefined?JSON.stringify(request):raw);
  const receiptBytes=encoder.encode(JSON.stringify(receipt));
  return reviewAgentoraR03(requestBytes,receiptBytes,repoOverride,
    contractOverride,signalOverride,{webcrypto,now});
}
async function refused(f,reason,opts){
  await assert.rejects(review(f,opts),new RegExp("R27_"+reason));
}
test("R27-01 exact original PhiMada request and offline Agentora R03 receipt correlate",async()=>{
  const f=fixture();
  const result=await review(f,{raw:f.raw});
  assert.equal(result.state,"ORIGINAL_REQUEST_AND_LOCAL_R03_RECEIPT_CORRELATED");
  assert.equal(result.requestSha256,f.receipt.request_sha256);
  assert.equal(result.repository,repo.full_name);
  assert.equal(result.sourceSha,SHA);
  assert.equal(result.sourceState,"CURRENT_HEAD_MATCHES_LOCAL_OBSERVATION");
  assert.equal(result.contractState,"LOCAL_CONTRACT_ALIGNED");
  assert.equal(result.requiredChecks,f.receipt.checks.length);
});
test("R27-02 receipt never asserts executed, verified, signed or approved",async()=>{
  const f=fixture(),r=await review(f,{raw:f.raw});
  for(const key of [
    "sourceAuthenticated","agentoraProducerAuthenticated",
    "githubRunAuthenticated","productVerified","completionVerified",
    "dispatched","operatorApproved","mergeAuthorized","dispatchAuthorized"
  ])assert.equal(r[key],false,key);
  assert.equal(r.independentChecksRun,0);
});
test("R27-03 byte-exact digest mismatch refuses even same structured JSON",async()=>{
  const f=fixture();
  await refused(f,"RECEIPT_REQUEST_DIGEST_MISMATCH",{
    raw:JSON.stringify(f.request)
  });
});
test("R27-04 forged digest only binds two untrusted local files, never authenticates Agentora",async()=>{
  const f=fixture();
  const raw=JSON.stringify(f.request);
  f.receipt.request_sha256=createHash("sha256").update(raw).digest("hex");
  const r=await review(f,{raw});
  assert.equal(r.originalRequestBytesMatched,true);
  assert.equal(r.agentoraProducerAuthenticated,false);
  assert.equal(r.githubRunAuthenticated,false);
});
test("R27-05 wrong repository ID or name held before any successful correlation",async()=>{
  const f=fixture();
  await refused(f,"REPOSITORY_BINDING_REFUSED",{
    repoOverride:{...repo,id:1},raw:f.raw
  });
  await refused(f,"REPOSITORY_BINDING_REFUSED",{
    repoOverride:{...repo,full_name:"MichaelWave369/BTM"},raw:f.raw
  });
  await refused(f,"REPOSITORY_BINDING_REFUSED",{
    repoOverride:{...repo,exampleOnly:true},raw:f.raw
  });
});
test("R27-06 receipt source SHA or branch mismatch fails",async()=>{
  const f=fixture();
  for(const changed of [
    {source_sha:MOVED},{default_branch:"dev"},
    {repository:"MichaelWave369/BTM"},
    {source_observed_utc:"2026-11-04T00:00:00Z"}
  ]) {
    await refused(f,"RECEIPT_SOURCE_MISMATCH",{
      raw:f.raw,receipt:{...f.receipt,...changed}
    });
  }
});
test("R27-07 forged authority flag, claimed execution or completion refuses",async()=>{
  const f=fixture();
  for(const changed of [
    {operator_approved:true},{verified_complete:true},
    {dispatch_authorized:true},{merge_authorized:true},
    {head_revalidated_by_agentora:true},{digest_is_authentication:true},
    {independent_checks_run:1},{independent_checks_run:false}
  ])await refused(f,"RECEIPT_AUTHORITY_REFUSED",{
    raw:f.raw,receipt:{...f.receipt,...changed}
  });
});
test("R27-08 forged request execution and merge fields refuse",async()=>{
  const f=fixture();
  for(const changed of [
    {execution_state:"FINISHED"},{independent_verification:"PASSED"},
    {approved_for_execution:true},{merge_authorized:true},
    {job_dispatch_authorized:true},{operator_review_required:false}
  ])await refused(f,"REQUEST_AUTHORITY_REFUSED",{
    request:{...f.request,...changed}
  });
});
test("R27-09 forged check result or evidence receipt refuses",async()=>{
  const f=fixture();
  for(const changed of [
    {verification_state:"PASS"},{evidence_receipt:{url:"https://evil.test"}},
    {check_id:"unlisted"},{operator_reviewed_claim:true},
    {lane:"AUTOMATION_CANDIDATE_ONLY"}
  ]) {
    const receipt={...f.receipt,checks:f.receipt.checks.map((x,i)=>
      i===1?{...x,...changed}:x)};
    await refused(f,"RECEIPT_CHECKS_REFUSED",{raw:f.raw,receipt});
  }
});
test("R27-10 unsupported, duplicated or out-of-order request checks refuse",async()=>{
  const f=fixture();
  for(const change of [
    {surface_types:["made_up"]},
    {surface_types:["web_app","web_app"]},
    {required_checks:f.request.required_checks.slice(1)},
    {required_checks:[...f.request.required_checks].reverse()}
  ])await assert.rejects(review(f,{request:{...f.request,...change}}),/R27_/);
});
test("R27-11 refuse truncated, oversized or invalid UTF8 inputs",async()=>{
  const f=fixture();
  await assert.rejects(reviewAgentoraR03(new Uint8Array(0),encoder.encode("{}"),
    repo,f.c,f.s,{webcrypto,now:NOW}),/R27_REQUEST_SIZE/);
  await assert.rejects(reviewAgentoraR03(new Uint8Array(R03_MAX_REQUEST_BYTES+1),
    encoder.encode("{}"),repo,f.c,f.s,{webcrypto,now:NOW}),/R27_REQUEST_SIZE/);
  await assert.rejects(reviewAgentoraR03(encoder.encode(f.raw),
    new Uint8Array(R03_MAX_RECEIPT_BYTES+1),repo,f.c,f.s,
    {webcrypto,now:NOW}),/R27_RECEIPT_SIZE/);
  await assert.rejects(reviewAgentoraR03(new Uint8Array([255,255]),
    encoder.encode("{}"),repo,f.c,f.s,
    {webcrypto,now:NOW}),/R27_REQUEST_JSON_INVALID/);
});
test("R27-12 extra fields and omitted fields fail closed",async()=>{
  const f=fixture();
  await refused(f,"REQUEST_FIELDS_REFUSED",{
    request:{...f.request,extra:"PASS"}
  });
  await refused(f,"RECEIPT_FIELDS_REFUSED",{
    raw:f.raw,receipt:{...f.receipt,verified_by_operator:"yes"}
  });
  const bad={...f.receipt};delete bad.merge_authorized;
  await refused(f,"RECEIPT_FIELDS_REFUSED",{raw:f.raw,receipt:bad});
});
test("R27-13 malformed, unzoned, impossible/future timestamps fail",async()=>{
  const f=fixture();
  for(const changed of [
    {prepared_utc:"2026-11-04T06:00:00"},
    {source_observed_utc:"BAD"},
    {prepared_utc:"2039-11-04T06:00:00Z"}
  ])await assert.rejects(review(f,{request:{...f.request,...changed}}),/R27_/);
  await refused(f,"RECEIPT_TIME_CHAIN_REFUSED",{
    raw:f.raw,receipt:{...f.receipt,received_utc:"2030-01-01T00:00:00Z"}
  });
});
test("R27-14 changed HEAD after local import is a recheck warning",async()=>{
  const f=fixture(),r=await review(f,{raw:f.raw});
  const context=recheckR03Context(r,repo,f.c,signal({headSha:MOVED}),NOW+20000);
  assert.equal(context.sourceState,"SOURCE_MOVED");
  assert.equal(context.contractState,"LOCAL_CONTRACT_ALIGNED");
  assert.equal(r.sourceAuthenticated,false);
});
test("R27-15 stale or missing signal does not claim present-day source acceptance",async()=>{
  const f=fixture(),r=await review(f,{raw:f.raw,signalOverride:null});
  assert.equal(r.sourceState,"CURRENT_HEAD_NOT_RECHECKED");
  const context=recheckR03Context(r,repo,f.c,signal({
    observedAt:new Date(NOW-16*60000).toISOString()
  }),NOW+20000);
  assert.equal(context.sourceState,"CURRENT_HEAD_NOT_RECHECKED");
});
test("R27-16 changed local contract after intake marks alignment invalid",async()=>{
  const f=fixture(),r=await review(f,{raw:f.raw});
  const c={...f.c,source_sha:MOVED};
  assert.equal(recheckR03Context(r,repo,c,f.s,NOW+20000).contractState,
    "CONTRACT_NOT_ALIGNED");
});
test("R27-17 wrong repo cannot reuse an imported receipt",async()=>{
  const f=fixture(),r=await review(f,{raw:f.raw});
  assert.deepEqual(recheckR03Context(r,{...repo,id:999},f.c,f.s,NOW),{
    sourceState:"NOT_CORRELATED",contractState:"NOT_CORRELATED"
  });
});
test("R27-18 UI requires two local files, reports unsigned and never calls API",()=>{
  const ui=readFileSync("src/agentora-r03-return.jsx","utf8");
  const lane=readFileSync("src/completion-lane.jsx","utf8");
  assert.match(ui,/Exact original PhiMada R8 request JSON/);
  assert.match(ui,/Agentora R0\.3 verification-intake\.json/);
  assert.match(ui,/reviewAgentoraR03\(/);
  assert.match(ui,/disabled=\{busy\|\|!requestFile\|\|!receiptFile\}/);
  assert.match(ui,/LOCAL REQUEST LINEAGE MATCHED/);
  assert.match(ui,/No job, test, source authentication, merge or release was verified/);
  assert.match(lane,/AgentoraR03Return key=\{selected\.id\}/);
  assert.doesNotMatch(ui,/\bfetch\s*\(|route\.fulfill|navigator\.sendBeacon|window\.localStorage/);
});
