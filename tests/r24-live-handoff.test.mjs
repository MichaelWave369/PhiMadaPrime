import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateR24Launch,runR24
} from "../scripts/r24_live_r20_handoff.mjs";

const main="a".repeat(40);
const run="41757700207";
const confirmation="REVIEW_EXISTING_R19_ON_LIVE_PAGES";
const script=readFileSync("scripts/r24_live_r20_handoff.mjs","utf8");
const py=readFileSync("scripts/r24_prepare_live_r20.py","utf8");
const wf=readFileSync(".github/workflows/r24-live-r20-handoff.yml","utf8");

test("R24-01 strict manual confirmation, exact SHA and integer run ID",()=>{
  assert.deepEqual(validateR24Launch({
    expectedSha:main,runId:run,confirmation
  }),{expectedSha:main,runId:run});
  for(const value of ["main","A".repeat(40),"a".repeat(39),null]){
    assert.throws(()=>validateR24Launch({
      expectedSha:value,runId:run,confirmation
    }),/R24_EXACT_MAIN_SHA_REQUIRED/);
  }
  for(const value of ["", "1e3","000123","0","1; gh pr merge",null]){
    assert.throws(()=>validateR24Launch({
      expectedSha:main,runId:value,confirmation
    }),/R24_RUN_ID_REQUIRED/);
  }
  assert.throws(()=>validateR24Launch({
    expectedSha:main,runId:run,confirmation:"yes"
  }),/R24_OPERATOR_CONFIRMATION_REQUIRED/);
});

test("R24-02 no browser or file access before launch guard passes",async()=>{
  let launches=0;
  await assert.rejects(runR24({
    expectedSha:main,runId:run,confirmation:"WRONG",
    reviewPath:"should-not-read",zipPath:"should-not-read"
  },{launchBrowser:()=>{
    launches++;throw Error("UNREACHABLE");
  }}),/R24_OPERATOR_CONFIRMATION_REQUIRED/);
  assert.equal(launches,0);
});

test("R24-03 workflow is operator-only, read permissions and exact source",()=>{
  assert.match(wf,/on:\n  workflow_dispatch:/);
  assert.match(wf,/permissions:\n  contents: read\n  actions: read/);
  assert.match(wf,/if: github\.event_name == 'workflow_dispatch'/);
  assert.match(wf,/persist-credentials: false/);
  assert.match(wf,/test "\$R24_MAIN_SHA" = "\$GITHUB_SHA"/);
  assert.match(wf,/REVIEW_EXISTING_R19_ON_LIVE_PAGES/);
  assert.doesNotMatch(wf,/^\s*(push|pull_request|schedule):/m);
  assert.doesNotMatch(wf,/\bpages: write\b|\bcontents: write\b/);
});

test("R24-04 invokes independent original ZIP reviewer, never fakes a review",()=>{
  assert.match(py,/import r20_review_council_browser as r20/);
  assert.match(py,/r20\.review\(run_id,archive,get_json,now=now\)/);
  assert.match(py,/hashlib\.sha256\(archive\)/);
  assert.match(py,/R24_ORIGINAL_ARCHIVE_HASH_REFUSED/);
  assert.match(py,/r20-private|r24-private/);
  assert.doesNotMatch(py,/\bsubprocess\.|\bos\.system\(/);
});

test("R24-05 downloader removes Authorization after allowlisted redirect",()=>{
  assert.match(py,/class|r20\.NoRedirect\(\)/);
  assert.match(py,/R24_REDIRECT_HOST_REFUSED/);
  assert.match(py,/HOST_SUFFIXES/);
  assert.match(py,/No Authorization header/);
  assert.match(py,/headers=\{"User-Agent": "phimada-r24-zip"\}/);
});

test("R24-06 browser verifies deployed SHA and source before/after",()=>{
  assert.match(script,/validateGithubSource\(repo,heads,sha\)/);
  assert.match(script,/page\.goto\(BROWSER_SITE/);
  assert.match(script,/getByTestId\("phimada-deployed-revision"\)/);
  assert.match(script,/headBefore=await observeMain\(expectedSha\)/);
  assert.match(script,/headAfter=await observeMain\(expectedSha\)/);
});

test("R24-07 actual R20 panel and exact original file pair are used",()=>{
  assert.match(script,/#phimada-r20-council-browser/);
  assert.match(script,/Go to R20 Council JSON \+ R19 ZIP import/);
  assert.match(script,/reviewPath==="r24-private\/r20-review\.json"/);
  assert.match(script,/zipPath==="r24-private\/original-r19\.zip"/);
  assert.match(script,/inputs\.nth\(0\)\.setInputFiles/);
  assert.match(script,/inputs\.nth\(1\)\.setInputFiles/);
  assert.match(script,/Corroborate R19 ZIP \+ GitHub source/);
});

test("R24-08 browser insists real GitHub API routes were exercised",()=>{
  assert.match(script,/realApiPaths\.add\(target\.pathname\)/);
  assert.match(script,/actions\/runs\/".runId|actions\/runs\/".runId/);
  assert.match(script,/R24_REAL_GITHUB_PATH_MISSING/);
  assert.match(script,/Original ZIP and GitHub digest: matched\./);
  assert.match(script,/9\/9 PASS/);
  assert.doesNotMatch(script,/route\.fulfill|MOCK_RUN|R23_MOCK/);
});

test("R24-09 historical old source accepted only as historical",()=>{
  assert.match(script,/review\.workflow_source_sha!==expectedSha/);
  assert.match(script,/Historical R19 browser evidence: main has moved/);
  assert.match(script,/R24_HISTORICAL_CLAIMED_CURRENT/);
  assert.match(script,/R24_EXISTING_R19_ARTIFACT_LIVE_R20_CORRELATED_HISTORICAL_SHA/);
});

test("R24-10 no writes and no authority, no Council inference",()=>{
  assert.match(script,/method\)\)/);
  assert.match(script,/await route\.abort\(\)/);
  assert.match(script,/\["GET","HEAD"\]/);
  assert.match(script,/source_authenticated:false/);
  assert.match(script,/scientific_evidence:false/);
  assert.match(script,/product_verified:false/);
  assert.match(script,/dispatch_authorized:false/);
  assert.match(script,/merge_authorized:false/);
  assert.match(script,/r19_rerun_triggered:false/);
  assert.doesNotMatch(script,/\bexec\s*\(|gh pr merge|gh workflow run/);
});

test("R24-11 JSON receipt excludes original ZIP/raw browser DOM",()=>{
  assert.match(script,/schema:"phimada\.r19-r20-live-handoff\.v0\.24"/);
  assert.match(script,/observed_utc:new Date\(\)\.toISOString\(\)/);
  assert.match(script,/r19_artifact_sha256:review\.artifact_sha256/);
  assert.match(script,/operator_review_required:true/);
  assert.doesNotMatch(script,/screenshot\(|page\.content\(|zip\.toString/);
});

test("R24-12 original R19 and R20 gates remain unchanged and manual",()=>{
  const manual=readFileSync(".github/workflows/r19-council-browser.yml","utf8");
  assert.match(manual,/on:\n  workflow_dispatch:/);
  assert.match(manual,/RUN_PHI_MADA_COUNCIL_BROWSER/);
  const ui=readFileSync("src/r20-council-browser-evidence.jsx","utf8");
  assert.match(ui,/Corroborate R19 ZIP \+ GitHub source/);
  assert.match(ui,/Clear R20 review/);
});
