// R24: operator-triggered real public Pages R20 evidence handoff acceptance.
// Imports R20's Python-validated ORIGINAL R19 ZIP + review JSON; no mock API.
// Never launches R19, executes Council models, writes GitHub, dispatches or merges.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BROWSER_SITE, BROWSER_REPO, validateGithubSource
} from "./r12_browser_contract.mjs";

const ROOT="https://api.github.com/repos/"+BROWSER_REPO;
const API_ORIGIN="https://api.github.com";
const R24_CONFIRM="REVIEW_EXISTING_R19_ON_LIVE_PAGES";
const SOURCE=/^[0-9a-f]{40}$/;
const POSITIVE=/^[1-9][0-9]{0,18}$/;
const CHECKS=Object.freeze([
  "actual_live_pages_revision",
  "public_catalog_and_r20_panel",
  "original_r19_files_accepted",
  "actual_github_artifact_correlated",
  "historical_or_current_source_truth",
  "clear_removes_report",
  "no_write_requests_observed",
  "main_sha_stable_after_review"
]);
function assert(ok,reason){if(!ok)throw Error(reason);}
function safe(error){
  return String(error?.message||error||"UNKNOWN")
    .replace(/[\r\n\t]+/g," ").slice(0,230);
}
export function validateR24Launch({expectedSha,runId,confirmation}) {
  assert(typeof expectedSha==="string"&&SOURCE.test(expectedSha),
    "R24_EXACT_MAIN_SHA_REQUIRED");
  assert(typeof runId==="string"&&POSITIVE.test(runId),"R24_RUN_ID_REQUIRED");
  assert(confirmation===R24_CONFIRM,"R24_OPERATOR_CONFIRMATION_REQUIRED");
  return {expectedSha,runId};
}
async function githubJson(path) {
  assert(["","/branches/main"].includes(path),"R24_GITHUB_PATH_REFUSED");
  const response=await fetch(ROOT+path,{
    method:"GET",redirect:"error",cache:"no-store",
    signal:AbortSignal.timeout(15000),
    headers:{Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      "User-Agent":"phimada-r24-existing-artifact"}
  });
  assert(response.ok,"R24_GITHUB_READ_REFUSED");
  const raw=await response.text();
  assert(raw.length<120000,"R24_GITHUB_RESPONSE_TOO_LARGE");
  try{return JSON.parse(raw);}catch{throw Error("R24_GITHUB_JSON_INVALID");}
}
async function observeMain(sha) {
  const repo=await githubJson("");
  const heads=[await githubJson("/branches/main"),
    await githubJson("/branches/main")];
  return validateGithubSource(repo,heads,sha);
}
function readInputs({reviewPath,zipPath,runId}) {
  assert(reviewPath==="r24-private/r20-review.json" &&
    zipPath==="r24-private/original-r19.zip","R24_FIXED_INPUT_PATHS_REQUIRED");
  const reviewBytes=readFileSync(reviewPath);
  const zip=readFileSync(zipPath);
  assert(reviewBytes.length>2&&reviewBytes.length<=65536,
    "R24_REVIEW_SIZE_REFUSED");
  assert(zip.length>0&&zip.length<=2000000,"R24_ARCHIVE_SIZE_REFUSED");
  let review;
  try{review=JSON.parse(reviewBytes.toString("utf8"));}
  catch{throw Error("R24_REVIEW_JSON_INVALID");}
  assert(review.schema==="phimada.council-browser-artifact-review.v0.20" &&
    review.workflow_run_id===Number(runId) &&
    review.repository===BROWSER_REPO &&
    review.source==="ORIGINAL_GITHUB_ACTIONS_ZIP_AND_REST_METADATA" &&
    ["R19_BROWSER_ARTIFACT_CORRELATED_HISTORICAL_SHA",
     "R19_BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA"].includes(review.state) &&
    review.artifact_bytes===zip.length &&
    review.artifact_sha256===createHash("sha256").update(zip).digest("hex") &&
    review.reported_check_count===9 &&
    review.reported_browser_checks_passed===true &&
    review.product_verified===false &&
    review.merge_authorized===false &&
    review.dispatch_authorized===false &&
    review.fixture_source_authenticated===false,
    "R24_REVIEW_ARCHIVE_MISMATCH");
  return {review,reviewBytes,zip};
}
export async function runR24({
  expectedSha,runId,confirmation,
  reviewPath="r24-private/r20-review.json",
  zipPath="r24-private/original-r19.zip"
},{launchBrowser=()=>chromium.launch({headless:true})}={}) {
  validateR24Launch({expectedSha,runId,confirmation});
  const {review,reviewBytes,zip}=readInputs({reviewPath,zipPath,runId});
  let browser=null,headBefore=null,headAfter=null,observedDeployment=null;
  let attemptedWrites=[],unexpectedHosts=[];
  const checks={},errors=[],realApiPaths=new Set();
  function capture(error){if(errors.length<15)errors.push(safe(error));}
  async function check(name,fn) {
    if(!CHECKS.includes(name))throw Error("R24_UNKNOWN_CHECK");
    try{await fn();checks[name]="PASS";}
    catch(error){checks[name]="FAIL";throw Error(name+": "+safe(error));}
  }
  try {
    headBefore=await observeMain(expectedSha);
    browser=await launchBrowser();
    const context=await browser.newContext({viewport:{width:1440,height:900},
      reducedMotion:"reduce",serviceWorkers:"block",acceptDownloads:false});
    await context.route("**/*",async route=>{
      const req=route.request(),target=new URL(req.url()),method=req.method();
      if(!["GET","HEAD"].includes(method)){
        if(attemptedWrites.length<10)attemptedWrites.push(method);
        await route.abort();return;
      }
      if(target.origin===API_ORIGIN)realApiPaths.add(target.pathname);
      if(![API_ORIGIN,new URL(BROWSER_SITE).origin].includes(target.origin)){
        if(unexpectedHosts.length<10)unexpectedHosts.push(target.origin);
        await route.abort();return;
      }
      await route.continue();
    });
    const page=await context.newPage();
    page.on("pageerror",error=>capture("PAGE_ERROR_"+safe(error)));
    const bay=page.locator("details.evidence-bay");
    const panel=page.locator("#phimada-r20-council-browser");
    const inputs=panel.locator('input[type="file"]');
    const result=panel.locator(".browser-evidence-result");
    const status=panel.locator('[role="status"]');
    await check("actual_live_pages_revision",async()=>{
      const response=await page.goto(BROWSER_SITE,{
        waitUntil:"domcontentloaded",timeout:45000
      });
      assert(response?.status()===200,"R24_SITE_NOT_HTTP_200");
      await page.locator("header.topbar").waitFor({timeout:20000});
      observedDeployment=await page.getByTestId("phimada-deployed-revision")
        .getAttribute("data-build-sha");
      assert(observedDeployment===expectedSha,"R24_DEPLOYED_MAIN_SHA_MISMATCH");
    });
    await check("public_catalog_and_r20_panel",async()=>{
      await page.waitForFunction(()=>
        document.querySelector(".feed-state")?.textContent?.includes("GITHUB PUBLIC"),
        null,{timeout:45000});
      await page.locator("button.mission-open-button").click();
      await bay.locator("summary").first().click();
      await page.getByRole("button",{
        name:"Go to R20 Council JSON + R19 ZIP import"
      }).click();
      assert(await panel.evaluate(el=>el.open),"R24_R20_PANEL_NOT_OPEN");
      assert(await inputs.count()===2,"R24_R20_UPLOADS_MISSING");
    });
    await check("original_r19_files_accepted",async()=>{
      await inputs.nth(0).setInputFiles({
        name:"r20-local-reviewed.json",mimeType:"application/json",buffer:reviewBytes
      });
      await page.waitForFunction(()=>
        document.querySelector("#phimada-r20-council-browser")
          ?.textContent?.includes("LOCAL REVIEW ONLY"),
        null,{timeout:15000});
      await inputs.nth(1).setInputFiles({
        name:"original-r19-actions.zip",mimeType:"application/zip",buffer:zip
      });
      const button=panel.getByRole("button",{
        name:"Corroborate R19 ZIP + GitHub source"
      });
      assert(await button.isEnabled(),"R24_IMPORT_BUTTON_DISABLED");
      await button.click();
      await result.waitFor({state:"visible",timeout:30000});
      assert(!((await status.textContent())||"").includes("evidence held"),
        "R24_R20_REPORT_HELD");
    });
    await check("actual_github_artifact_correlated",async()=>{
      const text=await result.textContent()||"";
      assert(text.includes("Original ZIP and GitHub digest: matched."),
        "R24_GITHUB_ZIP_DIGEST_NOT_CORRELATED");
      assert(text.includes("9/9 PASS"),"R24_REPORTED_CHECK_COUNT_MISSING");
      assert(text.includes("Product complete: NO"),"R24_PRODUCT_ASSERTION_MISSING");
      assert(text.includes("Merge or dispatch authorized: NO"),
        "R24_AUTHORITY_ASSERTION_MISSING");
      const runBase="/repos/"+BROWSER_REPO+"/actions/runs/"+runId;
      for(const path of [runBase,runBase+"/artifacts",
        "/repos/"+BROWSER_REPO,"/repos/"+BROWSER_REPO+"/branches/main"]) {
        assert(realApiPaths.has(path),"R24_REAL_GITHUB_PATH_MISSING");
      }
    });
    await check("historical_or_current_source_truth",async()=>{
      const content=await result.textContent()||"";
      const historical=review.workflow_source_sha!==expectedSha;
      assert(historical?
        content.includes("Historical R19 browser evidence: main has moved"):
        content.includes("currently observed main SHA"),
        "R24_SOURCE_CLASSIFICATION_WRONG");
      if(historical)assert(!content.includes("currently observed main SHA"),
        "R24_HISTORICAL_CLAIMED_CURRENT");
    });
    await check("clear_removes_report",async()=>{
      await panel.getByRole("button",{name:"Clear R20 review"}).click();
      await result.waitFor({state:"hidden",timeout:10000});
      assert(((await status.textContent())||"")
        .includes("No corroborated R19 browser evidence"),
        "R24_CLEAR_DID_NOT_RESET");
    });
    await check("no_write_requests_observed",async()=>{
      assert(attemptedWrites.length===0,"R24_UI_WRITE_REQUEST_REFUSED");
    });
    await context.close();
  } catch(error){capture("R24_"+safe(error));}
  finally {
    if(browser)await browser.close().catch(()=>{});
    try {
      headAfter=await observeMain(expectedSha);
      checks.main_sha_stable_after_review="PASS";
    } catch(error) {
      checks.main_sha_stable_after_review="FAIL";
      capture("R24_POSTFLIGHT_"+safe(error));
    }
  }
  const passed=headBefore===expectedSha&&headAfter===expectedSha&&
    observedDeployment===expectedSha&&
    CHECKS.every(key=>checks[key]==="PASS")&&
    errors.length===0&&attemptedWrites.length===0;
  return {
    schema:"phimada.r19-r20-live-handoff.v0.24",
    state:passed?
      review.workflow_source_sha===expectedSha?
        "R24_EXISTING_R19_ARTIFACT_LIVE_R20_CORRELATED_CURRENT_SHA":
        "R24_EXISTING_R19_ARTIFACT_LIVE_R20_CORRELATED_HISTORICAL_SHA":
      "R24_EXISTING_R19_ARTIFACT_LIVE_R20_HELD",
    observed_utc:new Date().toISOString(),workflow_run_id:process.env.GITHUB_RUN_ID||null,
    target_url:BROWSER_SITE,source_sha:expectedSha,
    observed_deployed_revision:observedDeployment,
    r19_run_id:Number(runId),r19_source_sha:review.workflow_source_sha,
    r19_artifact_sha256:review.artifact_sha256,
    r19_evidence_is_historical:review.workflow_source_sha!==expectedSha,
    source_head_before:headBefore,source_head_after:headAfter,
    checks:Object.fromEntries(CHECKS.map(key=>[key,checks[key]||"NOT_RUN"])),
    errors,attempted_write_methods:attemptedWrites,
    unexpected_request_origins:unexpectedHosts,
    browser_handoff_passed:passed,
    r19_rerun_triggered:false,
    original_artifact_zip_verified_by_r20_python:true,
    webcrypto_zip_digest_correlated_by_live_browser:
      checks.actual_github_artifact_correlated==="PASS",
    source_cryptographically_attested:false,independent_browser_replay:false,
    source_authenticated:false,scientific_evidence:false,
    product_verified:false,dispatch_authorized:false,merge_authorized:false,
    operator_review_required:true
  };
}
async function main(){
  const argv=process.argv.slice(2);
  assert(argv.length===2&&argv[0]==="--output"&&
    argv[1]==="r24-artifacts/live-r20-handoff.json",
    "R24_FIXED_OUTPUT_REQUIRED");
  const report=await runR24({
    expectedSha:process.env.R24_MAIN_SHA,
    runId:process.env.R24_R19_RUN_ID,
    confirmation:process.env.R24_CONFIRMATION
  });
  await mkdir(dirname(argv[1]),{recursive:true,mode:0o700});
  const file=await open(argv[1],"wx",0o600);
  try{await file.writeFile(JSON.stringify(report,null,2)+"\n");await file.sync();}
  finally{await file.close();}
  process.stdout.write(JSON.stringify({
    state:report.state,passed_checks:Object.values(report.checks)
      .filter(value=>value==="PASS").length,
    total_checks:CHECKS.length,real_r19_run_id:report.r19_run_id,
    evidence_historical:report.r19_evidence_is_historical,
    product_verified:false,merge_authorized:false})+"\n");
  process.exitCode=report.browser_handoff_passed?0:2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error=>{
    process.stderr.write("R24_HELD_"+safe(error)+"\n");process.exitCode=1;
  });
}
