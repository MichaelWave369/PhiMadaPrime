import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  R20_SCHEMA, R20_MAX_REVIEW_BYTES, R20_MAX_ARCHIVE_BYTES,
  parseR20CouncilReview, corroborateR20Council
} from "../src/r20-council-browser-evidence.mjs";

const NOW=Date.parse("2026-11-03T23:48:00Z");
const REPO="MichaelWave369/PhiMadaPrime";
const SHA="a".repeat(40), OLD="b".repeat(40);
const RUN=41777777777;
const ORIGINAL=Buffer.from("SYNTHETIC_ARCHIVE_BYTES_FOR_BROWSER_HASH_TEST_ONLY");
const ZIP=new Blob([ORIGINAL],{type:"application/zip"});
const DIGEST=createHash("sha256").update(ORIGINAL).digest("hex");
const CATALOG=[{id:1443845098,full_name:REPO,archived:false,exampleOnly:false}];
const CHECKS=["page_deployed_sha","mission_board_and_council_open",
  "golden_receipt_display","tampered_receipt_refused","rehashed_authority_refused",
  "self_consistent_forgery_untrusted","clear_restores_empty",
  "reload_discards_review","no_write_requests_observed"];
function sourceReport(overrides={}) {
  return {
    schema:R20_SCHEMA,
    state:"R19_BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA",
    source:"ORIGINAL_GITHUB_ACTIONS_ZIP_AND_REST_METADATA",
    repository:REPO,repository_id:1443845098,
    workflow_path:".github/workflows/r19-council-browser.yml",
    workflow_run_id:RUN,workflow_attempt:1,
    workflow_source_sha:SHA,observed_head_sha:SHA,
    source_is_current:true,source_head_stable:true,
    artifact_id:13579,artifact_name:"phimada-r19-council-"+RUN,
    artifact_bytes:ZIP.size,artifact_sha256:DIGEST,artifact_member_validated:true,
    reported_check_count:9,reported_checks:Object.fromEntries(CHECKS.map(k=>[k,"PASS"])),
    fixture_sha256:"c".repeat(64),
    fixture_source_authenticated:false,council_consumer_execution_observed:false,
    independent_browser_replay:false,reported_browser_checks_passed:true,
    scientific_evidence:false,product_verified:false,
    merge_authorized:false,dispatch_authorized:false,
    operator_review_required:true,
    run_observed_utc:"2026-11-03T23:30:00Z",
    reviewed_utc:"2026-11-03T23:48:00Z",
    ...overrides
  };
}
const parse=(data=sourceReport(),catalog=CATALOG)=>parseR20CouncilReview(
  JSON.stringify(data),catalog,NOW);
function github({head=SHA,second=head,digest=DIGEST,runEvent="workflow_dispatch",
  runSha=SHA,runConclusion="success",artifactId=13579,repoId=1443845098,
  totalCount=1,artifactBytes=ZIP.size}={}) {
  return {
    run:{id:RUN,event:runEvent,
      path:".github/workflows/r19-council-browser.yml",
      status:"completed",conclusion:runConclusion,run_attempt:1,
      head_sha:runSha,
      repository:{id:1443845098,full_name:REPO},
      head_repository:{full_name:REPO},
      created_at:"2026-11-03T23:15:00Z"},
    listing:{total_count:totalCount,artifacts:[{
      id:artifactId,name:"phimada-r19-council-"+RUN,
      expired:false,size_in_bytes:artifactBytes,
      digest:"sha256:"+digest,workflow_run:{id:RUN}
    }]},
    repository:{id:repoId,full_name:REPO,
      owner:{login:"MichaelWave369"},private:false,
      archived:false,default_branch:"main"},
    first:{name:"main",commit:{sha:head}},
    second:{name:"main",commit:{sha:second}}
  };
}
function fetcher(data,calls=[]) {
  let headReads=0;
  return async (url,opts)=>{
    calls.push({url,opts});
    assert.equal(opts.method,"GET");
    assert.equal(opts.credentials,"omit");
    assert.equal(opts.redirect,"error");
    assert.ok(url.startsWith("https://api.github.com/repos/"+REPO));
    const response=url.endsWith("/branches/main")?
      headReads++?data.second:data.first:
      url.endsWith("/artifacts?per_page=100")?data.listing:
      url.endsWith("/actions/runs/"+RUN)?data.run:data.repository;
    return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(response)};
  };
}
const run=(review=parse(),data=github(),calls=[])=>corroborateR20Council(
  review,ZIP,CATALOG,{fetcher:fetcher(data,calls),cryptoApi:webcrypto,now:NOW});

test("R20-01 local review is bounded and uncorroborated before external checks",()=>{
  const p=parse();
  assert.equal(p.state,"R20_LOCAL_REPORT_UNCORROBORATED");
  assert.equal(p.runId,RUN);
  assert.equal(p.artifactSha256,DIGEST);
  assert.equal(p.productVerified,false);
});

test("R20-02 original ZIP digest and public manual workflow yield current SHA correlation",async()=>{
  const calls=[];
  const r=await run(parse(),github(),calls);
  assert.equal(r.state,"R20_R19_ARTIFACT_CORRELATED_CURRENT_SHA");
  assert.equal(r.sourceCurrent,true);
  assert.equal(r.reportedBrowserChecks,9);
  assert.equal(calls.length,5);
  for(const flag of ["browserIndependentlyReplayed","sourceAuthenticated",
    "scientificEvidence","productVerified","mergeAuthorized","dispatchAuthorized"])
    assert.equal(r[flag],false,flag);
});

test("R20-03 moved main is historical, not current acceptance",async()=>{
  const r=await run(parse(),github({head:OLD}));
  assert.equal(r.state,"R20_R19_ARTIFACT_CORRELATED_HISTORICAL_SHA");
  assert.equal(r.sourceCurrent,false);
});

test("R20-04 changing HEAD during two observations holds result",async()=>{
  const r=await run(parse(),github({head:SHA,second:OLD}));
  assert.equal(r.state,"R20_HEAD_CHANGED_DURING_REVIEW");
  assert.equal(r.sourceCurrent,false);
});

test("R20-05 wrong artifact digest or size is refused",async()=>{
  await assert.rejects(run(parse(),github({digest:"d".repeat(64)})),/R20_ARTIFACT_MISMATCH/);
  await assert.rejects(run(parse(),github({artifactBytes:ZIP.size+1})),/R20_ARTIFACT_MISMATCH/);
  const fake=parse(sourceReport({artifact_sha256:"f".repeat(64)}));
  await assert.rejects(run(fake),/R20_LOCAL_ZIP_HASH_REFUSED/);
});

test("R20-06 non-manual run, failed run or wrong source SHA is refused",async()=>{
  await assert.rejects(run(parse(),github({runEvent:"push"})),/R20_RUN_MISMATCH/);
  await assert.rejects(run(parse(),github({runConclusion:"failure"})),/R20_RUN_MISMATCH/);
  await assert.rejects(run(parse(),github({runSha:OLD})),/R20_RUN_MISMATCH/);
});

test("R20-07 wrong source repo and run artifact identifier fail closed",async()=>{
  await assert.rejects(run(parse(),github({repoId:0})),/R20_REPOSITORY_MISMATCH/);
  await assert.rejects(run(parse(),github({artifactId:123})),/R20_ARTIFACT_MISMATCH/);
  await assert.rejects(run(parse(),github({totalCount:2})),/R20_ARTIFACT_LIST_REFUSED/);
});

test("R20-08 fabricated grants and source-auth claims are rejected even in valid JSON",()=>{
  for(const [name,val] of [
    ["merge_authorized",true],["dispatch_authorized",true],
    ["scientific_evidence",true],["product_verified",true],
    ["fixture_source_authenticated",true],["independent_browser_replay",true],
    ["council_consumer_execution_observed",true],
    ["operator_review_required",false],["reported_browser_checks_passed",false]
  ])assert.throws(()=>parse(sourceReport({[name]:val})),/R20_REVIEW_TRUST_REFUSED/,name);
});

test("R20-09 missing, failed or invented check is refused",()=>{
  for(const id of CHECKS){
    const x=sourceReport();x.reported_checks[id]="FAIL";
    assert.throws(()=>parse(x),/R20_REVIEW_TRUST_REFUSED/,id);
  }
  const extra=sourceReport();extra.reported_checks.sneaky="PASS";
  assert.throws(()=>parse(extra),/R20_REVIEW_TRUST_REFUSED/);
});

test("R20-10 source-state contradictions and extra private fields are refused",()=>{
  assert.throws(()=>parse(sourceReport({
    state:"R19_BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA",
    source_is_current:true
  })),/R20_REVIEW_TRUST_REFUSED/);
  assert.throws(()=>parse(sourceReport({secret_prompt:"do something"})),/R20_REVIEW_FIELDS_REFUSED/);
  assert.throws(()=>parse(sourceReport({observed_head_sha:"fake"})),/R20_REVIEW_TRUST_REFUSED/);
});

test("R20-11 catalog is public-only and report must be fresh",()=>{
  assert.throws(()=>parse(sourceReport(),[]),/R20_PUBLIC_CATALOG_REQUIRED/);
  assert.throws(()=>parse(sourceReport({reviewed_utc:"2026-10-01T12:00:00Z"})),
    /R20_REVIEW_TRUST_REFUSED/);
});

test("R20-12 malformed and oversized input fails before network",()=>{
  assert.throws(()=>parseR20CouncilReview("{bad",CATALOG,NOW),/R20_JSON_REFUSED/);
  assert.throws(()=>parseR20CouncilReview("a".repeat(R20_MAX_REVIEW_BYTES+1),
    CATALOG,NOW),/R20_REVIEW_SIZE_REFUSED/);
  assert.ok(R20_MAX_ARCHIVE_BYTES<=2000000);
});

test("R20-13 actual React Evidence Bay houses the new standalone observer",()=>{
  const s=readFileSync("src/evidence-bay.jsx","utf8");
  assert.match(s,/import \{ R20CouncilBrowserEvidence \} from "\.\/r20-council-browser-evidence\.jsx"/);
  assert.match(s,/<R20CouncilBrowserEvidence catalog=\{catalog\} \/>/);
  assert.match(s,/<CouncilEvidence \/>/);
  const ui=readFileSync("src/r20-council-browser-evidence.jsx","utf8");
  assert.match(ui,/Clear R20 review/);
  assert.match(ui,/R20 \/ COUNCIL LIVE BROWSER EVIDENCE/);
  assert.doesNotMatch(ui,/\blocalStorage\.|\bindexedDB\.|\bpostMessage\s*\(/);
});

test("R20-14 Python reviewer is source-only and refuses arbitrary API routes",()=>{
  const p=readFileSync("scripts/r20_review_council_browser.py","utf8");
  assert.match(p,/class NoRedirect/);
  assert.match(p,/def zip_receipt/);
  assert.match(p,/JSON_DUPLICATE_KEY/);
  assert.match(p,/GITHUB_PATH_REFUSED/);
  assert.match(p,/ZIP_MEMBER_COUNT_REFUSED/);
  assert.doesNotMatch(p,/\bsubprocess\.|\bos\.system\(/);
});
