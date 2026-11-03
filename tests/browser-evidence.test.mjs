import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto, createHash } from "node:crypto";
import {
  R13_REVIEW_SCHEMA, parseBrowserReview, corroborateBrowserReview
} from "../src/browser-evidence.mjs";

const NOW = Date.parse("2026-11-03T21:00:00Z");
const SHA = "a".repeat(40), MOVED = "b".repeat(40);
const RUN = 41710656371;
const DATA = Buffer.from("Synthetic browser artifact test fixture");
const ZIP = new Blob([DATA]);
const DIGEST = createHash("sha256").update(DATA).digest("hex");
const CATALOG = [{
  id: 1443845098, name: "PhiMadaPrime",
  full_name: "MichaelWave369/PhiMadaPrime",
  archived: false, exampleOnly: false
}];
const keys = ["page_boot", "public_catalog", "search_repo", "inspect_desk",
  "close_inspector", "open_mission_board", "evidence_bay_controls",
  "return_to_desks"];
const flags = {
  independently_replayed: false, complete_user_journeys_verified: false,
  accessibility_verified: false, deployment_cryptographically_attested: false,
  product_verified: false, verified_complete: false, merge_authorized: false,
  dispatch_authorized: false
};
function report(patch={}) {
  return {
    schema: R13_REVIEW_SCHEMA,
    state: "BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA",
    reviewed_utc: "2026-11-03T20:25:00Z",
    browser_observed_utc: "2026-11-03T20:14:52Z",
    source: "GITHUB_ACTIONS_RUN_AND_ARTIFACT_SHA256",
    repository: "MichaelWave369/PhiMadaPrime", repository_id: 1443845098,
    workflow_path: ".github/workflows/r12-browser-smoke.yml",
    workflow_run_id: RUN, workflow_attempt: 1, workflow_source_sha: SHA,
    artifact_id: 13266454585, artifact_name: "phimada-r12-browser-" + RUN,
    artifact_bytes: ZIP.size, artifact_sha256: DIGEST,
    artifact_digest_correlated: true, browser_source_sha: SHA,
    current_observed_head_sha: SHA, current_head_matches_browser_source: true,
    reported_browser_checks: Object.fromEntries(keys.map(k=>[k,"PASS"])),
    browser_check_count: 8, artifact_zip_contents_validated: true,
    operator_review_required: true,
    ...flags, ...patch
  };
}
function parse(value=report(),rows=CATALOG,time=NOW) {
  return parseBrowserReview(JSON.stringify(value),rows,time);
}
function github({ head=SHA, secondHead=head, digest=DIGEST,
  event="workflow_dispatch", status="completed", conclusion="success",
  runAttempt=1, repoId=1443845098, archived=false }={}) {
  return {
    run: {
      id:RUN, path:".github/workflows/r12-browser-smoke.yml", event, status,
      conclusion, run_attempt:runAttempt, head_sha:SHA,
      created_at:"2026-11-03T20:14:01Z",
      repository:{id:1443845098,full_name:"MichaelWave369/PhiMadaPrime"},
      head_repository:{full_name:"MichaelWave369/PhiMadaPrime"}
    },
    artifacts:{total_count:1,artifacts:[{
      id:13266454585,name:"phimada-r12-browser-"+RUN,
      expired:false,size_in_bytes:ZIP.size,
      digest:"sha256:"+digest,workflow_run:{id:RUN}
    }]},
    repo:{id:repoId,full_name:"MichaelWave369/PhiMadaPrime",
      owner:{login:"MichaelWave369"}, private:false,archived,
      default_branch:"main"},
    head:{name:"main",commit:{sha:head}},
    second:{name:"main",commit:{sha:secondHead}}
  };
}
function fetcher(data,calls) {
  let headReads=0;
  return async (url,options) => {
    calls.push({url,options});
    assert.equal(options.method,"GET");
    assert.equal(options.credentials,"omit");
    assert.equal(options.redirect,"error");
    assert(url.startsWith("https://api.github.com/repos/MichaelWave369/PhiMadaPrime"));
    const answer = url.includes("/actions/runs/") ?
      url.includes("artifacts?per_page=100") ? data.artifacts : data.run :
      url.endsWith("/branches/main") ?
      (headReads++ ? data.second : data.head) : data.repo;
    return {ok:true, headers:{get:()=>null},
      text:async()=>JSON.stringify(answer)};
  };
}
function correlate(review=parse(),zip=ZIP,data=github(),calls=[]) {
  return corroborateBrowserReview(review,zip,CATALOG,
    {fetcher:fetcher(data,calls),cryptoApi:webcrypto,now:NOW});
}
test("valid R13 review imports only local uncorroborated metadata",()=>{
  const r=parse();
  assert.equal(r.status,"LOCAL_R13_REPORT_UNCORROBORATED");
  assert.equal(r.sha,SHA);assert.equal(r.browserCheckCount,8);
  assert.equal(r.productVerified,false);
});
test("example catalog or absent PhiMada live identity held",()=>{
  assert.throws(()=>parse(report(),[]),/PUBLIC_CATALOG_REQUIRED/);
  assert.throws(()=>parse(report(),[{...CATALOG[0],exampleOnly:true}]),
    /PUBLIC_CATALOG_REQUIRED/);
});
test("signed, product, merge and accessibility forgeries rejected",()=>{
  for(const key of [...Object.keys(flags),"operator_review_required"]){
    const changed=key==="operator_review_required"?false:true;
    assert.throws(()=>parse(report({[key]:changed})),/UNTRUSTED/);
  }
});
test("wrong run, repository, workflow, source or artifact rejected",()=>{
  for(const patch of [
    {workflow_run_id:0},{repository_id:42},
    {workflow_attempt:2},{workflow_path:"other.yml"},
    {workflow_source_sha:MOVED},{artifact_sha256:"bad"},
    {artifact_name:"malicious.zip"},{artifact_digest_correlated:false}
  ])assert.throws(()=>parse(report(patch)),/UNTRUSTED/);
});
test("missing or fake browser passes do not appear as evidence",()=>{
  for(const patch of [
    {reported_browser_checks:{page_boot:"PASS"}},
    {reported_browser_checks:{...report().reported_browser_checks,inspect_desk:"FAIL"}},
    {browser_check_count:7},{artifact_zip_contents_validated:false}
  ])assert.throws(()=>parse(report(patch)),/UNTRUSTED/);
});
test("historical reports parse but never claim current",()=>{
  const r=parse(report({state:"BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA",
    current_observed_head_sha:MOVED,current_head_matches_browser_source:false}));
  assert.equal(r.sha,SHA);
});
test("expired, future or reversed report timeline rejected",()=>{
  assert.throws(()=>parse(report(),CATALOG,NOW+8*24*3600000),/UNTRUSTED/);
  assert.throws(()=>parse(report({reviewed_utc:"3000-01-01T00:00:00Z"})),/UNTRUSTED/);
  assert.throws(()=>parse(report({browser_observed_utc:"2026-11-03T20:55:00Z"})),
    /UNTRUSTED/);
});
test("tampered ZIP rejected before any public fetch",async()=>{
  const calls=[];
  await assert.rejects(()=>correlate(parse(),new Blob(["tampered"]),github(),calls),
    /LOCAL_ZIP_DIGEST_MISMATCH/);
  assert.equal(calls.length,0);
});
test("successful GitHub run and ZIP digest correlated but not certified",async()=>{
  const calls=[]; const r=await correlate(parse(),ZIP,github(),calls);
  assert.equal(r.status,"R13_BROWSER_ARTIFACT_CORRELATED_CURRENT_HEAD");
  assert.equal(r.reportedBrowserSmokePassed,true);
  assert.equal(r.browserSourceCurrent,true);
  assert.equal(r.completionVerified,false);
  assert.equal(r.accessibilityVerified,false);
  assert.equal(r.browserContentIndependentlyReplayed,false);
  assert.equal(r.mergeAuthorized,false);
  assert.equal(calls.length,5);
});
test("wrong event, unsuccessful run and rerun rejected",async()=>{
  for(const patch of [{event:"push"},{status:"queued"},
    {conclusion:"failure"},{runAttempt:2}]){
    await assert.rejects(()=>correlate(parse(),ZIP,github(patch)),
      /GITHUB_RUN_MISMATCH/);
  }
});
test("GitHub artifact digest mismatch and wrong repository held",async()=>{
  await assert.rejects(()=>correlate(parse(),ZIP,
    github({digest:"f".repeat(64)})),/GITHUB_ARTIFACT_MISMATCH/);
  await assert.rejects(()=>correlate(parse(),ZIP,
    github({repoId:11})),/GITHUB_REPOSITORY_MISMATCH/);
  await assert.rejects(()=>correlate(parse(),ZIP,
    github({archived:true})),/GITHUB_REPOSITORY_MISMATCH/);
});
test("later source movement makes browser evidence historical",async()=>{
  const r=await correlate(parse(),ZIP,github({head:MOVED}));
  assert.equal(r.status,"R13_BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA");
  assert.equal(r.browserSourceCurrent,false);
  assert.equal(r.productVerified,false);
});
test("moving HEAD between two GitHub reads is distinct held status",async()=>{
  const r=await correlate(parse(),ZIP,github({head:SHA,secondHead:MOVED}));
  assert.equal(r.status,"R13_CURRENT_HEAD_CHANGED_DURING_READ");
  assert.equal(r.browserSourceCurrent,false);
});
test("GitHub read failure never accepted",async()=>{
  await assert.rejects(()=>corroborateBrowserReview(parse(),ZIP,CATALOG,{
    fetcher:async()=>({ok:false}),cryptoApi:webcrypto,now:NOW
  }),/GITHUB_READ_FAILED/);
});
