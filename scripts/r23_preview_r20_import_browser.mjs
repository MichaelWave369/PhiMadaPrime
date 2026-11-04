// R23: full R20 import through real isolated Chromium and mocked public GitHub.
// All API data in this test is synthetic: never claim a live R19 run was checked.
// R19 and R20 authentic evidence validation remain independent operator gates.
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, open } from "node:fs/promises";

const PREVIEW = "http://127.0.0.1:4173/";
const REPO = "MichaelWave369/PhiMadaPrime", REPO_ID = 1443845098;
const MOCK_RUN = 41777777777, MOCK_ARTIFACT = 13579;
const SOURCE = "a".repeat(40), MOVED = "b".repeat(40);
const API = "https://api.github.com";
const WORKFLOW = ".github/workflows/r19-council-browser.yml";
const HEX40 = /^[a-f0-9]{40}$/;
const CHECKS = Object.freeze([
  "preview_build_marker",
  "simulated_public_catalog_ready",
  "wrong_agentora_import_refused",
  "r22_shortcut_opens_r20",
  "r20_mock_zip_and_metadata_correlated",
  "corrupt_zip_refused",
  "forged_reviewer_authority_refused",
  "source_moved_reported_historical",
  "clear_and_reload_discard_reviews",
  "no_external_or_write_requests"
]);
function hash(value) {return createHash("sha256").update(value).digest("hex");}
function safe(error) {return String(error?.message||error||"UNKNOWN")
  .replace(/[\r\n\t]+/g," ").slice(0,200);}
function assert(condition,reason) {if(!condition)throw new Error(reason);}
// Generate a genuine, stored ZIP in memory. Contents are NOT a GitHub artifact.
function crc32(buf) {
  let value=0xffffffff;
  for(const byte of buf) {
    value^=byte;
    for(let i=0;i<8;i++) value=(value>>>1)^((value&1)?0xedb88320:0);
  }
  return (value^0xffffffff)>>>0;
}
function mockZip() {
  const name=Buffer.from("council-browser.json");
  const payload=Buffer.from(JSON.stringify({
    schema:"phimada.council-live-browser.v0.19",
    scope:"R23_MOCK_ONLY_NOT_A_REAL_R19_ACTIONS_RUN",
    source_authenticated:false,model_executed:false,
    scientific_evidence:false,merge_authorized:false
  }),"utf8");
  const crc=crc32(payload);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);
  local.writeUInt16LE(20,4);
  local.writeUInt32LE(crc,14);
  local.writeUInt32LE(payload.length,18);
  local.writeUInt32LE(payload.length,22);
  local.writeUInt16LE(name.length,26);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0);
  central.writeUInt16LE(20,4);
  central.writeUInt16LE(20,6);
  central.writeUInt32LE(crc,16);
  central.writeUInt32LE(payload.length,20);
  central.writeUInt32LE(payload.length,24);
  central.writeUInt16LE(name.length,28);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(1,8); end.writeUInt16LE(1,10);
  end.writeUInt32LE(central.length+name.length,12);
  end.writeUInt32LE(local.length+name.length+payload.length,16);
  return Buffer.concat([local,name,payload,central,name,end]);
}
function report(zip) {
  const checkedAt=new Date();
  const observedAt=new Date(checkedAt.getTime()-20000);
  const names=[
    "page_deployed_sha","mission_board_and_council_open",
    "golden_receipt_display","tampered_receipt_refused",
    "rehashed_authority_refused","self_consistent_forgery_untrusted",
    "clear_restores_empty","reload_discards_review",
    "no_write_requests_observed"
  ];
  return {
    schema:"phimada.council-browser-artifact-review.v0.20",
    state:"R19_BROWSER_ARTIFACT_CORRELATED_CURRENT_SHA",
    source:"ORIGINAL_GITHUB_ACTIONS_ZIP_AND_REST_METADATA",
    repository:REPO,repository_id:REPO_ID,workflow_path:WORKFLOW,
    workflow_run_id:MOCK_RUN,workflow_attempt:1,
    workflow_source_sha:SOURCE,observed_head_sha:SOURCE,
    source_is_current:true,source_head_stable:true,
    artifact_id:MOCK_ARTIFACT,artifact_name:"phimada-r19-council-"+MOCK_RUN,
    artifact_bytes:zip.length,artifact_sha256:hash(zip),
    artifact_member_validated:true,reported_check_count:names.length,
    reported_checks:Object.fromEntries(names.map(key=>[key,"PASS"])),
    fixture_sha256:"c".repeat(64),
    fixture_source_authenticated:false,
    council_consumer_execution_observed:false,
    independent_browser_replay:false,
    reported_browser_checks_passed:true,
    scientific_evidence:false,product_verified:false,
    merge_authorized:false,dispatch_authorized:false,
    operator_review_required:true,
    run_observed_utc:observedAt.toISOString(),
    reviewed_utc:checkedAt.toISOString()
  };
}
function makeRun(now=new Date()) {
  return {
    id:MOCK_RUN,event:"workflow_dispatch",path:WORKFLOW,
    status:"completed",conclusion:"success",run_attempt:1,head_sha:SOURCE,
    repository:{id:REPO_ID,full_name:REPO},
    head_repository:{full_name:REPO},
    created_at:new Date(now.getTime()-30000).toISOString()
  };
}

export async function runR23(expectedSha,{launchBrowser=()=>chromium.launch({headless:true})}={}) {
  assert(typeof expectedSha==="string"&&HEX40.test(expectedSha),"R23_BUILD_SHA_REQUIRED");
  const zip=mockZip(),review=report(zip);
  let browser=null,observedSha=null,observedHead=SOURCE,blockedExternal=0;
  const checks={},errors=[],unsafeMethods=[],requests=[];
  const record=error=>{if(errors.length<12)errors.push(safe(error));};
  const check=async(id,fn)=>{
    if(!CHECKS.includes(id))throw new Error("R23_UNKNOWN_CHECK");
    try{await fn();checks[id]="PASS";}
    catch(error){checks[id]="FAIL";throw Error(id+": "+safe(error));}
  };
  try {
    browser=await launchBrowser();
    const context=await browser.newContext({viewport:{width:1440,height:900},
      reducedMotion:"reduce",serviceWorkers:"block",acceptDownloads:false});
    await context.route("**/*",async route=>{
      const request=route.request(),url=new URL(request.url()),method=request.method();
      requests.push({origin:url.origin,method});
      if(!["GET","HEAD"].includes(method)) {
        if(unsafeMethods.length<10)unsafeMethods.push(method);
        await route.abort();return;
      }
      if(url.origin===new URL(PREVIEW).origin){await route.continue();return;}
      if(url.origin!==API){blockedExternal++;await route.abort();return;}
      const path=url.pathname;
      let result=null;
      if(path==="/users/MichaelWave369/repos" &&
         url.searchParams.get("page")==="1" &&
         url.searchParams.get("per_page")==="100") {
        result=[{id:REPO_ID,name:"PhiMadaPrime",full_name:REPO,
          owner:{login:"MichaelWave369"},private:false,archived:false,
          description:"R23 MOCK CATALOG ONLY",language:"JavaScript",
          pushed_at:new Date().toISOString(),homepage:""}];
      } else if(path==="/repos/"+REPO+"/actions/runs/"+MOCK_RUN) {
        result=makeRun();
      } else if(path==="/repos/"+REPO+"/actions/runs/"+MOCK_RUN+"/artifacts" &&
          url.searchParams.get("per_page")==="100") {
        result={total_count:1,artifacts:[{
          id:MOCK_ARTIFACT,name:"phimada-r19-council-"+MOCK_RUN,
          expired:false,size_in_bytes:zip.length,digest:"sha256:"+hash(zip),
          workflow_run:{id:MOCK_RUN}
        }]};
      } else if(path==="/repos/"+REPO) {
        result={id:REPO_ID,full_name:REPO,owner:{login:"MichaelWave369"},
          private:false,archived:false,default_branch:"main"};
      } else if(path==="/repos/"+REPO+"/branches/main") {
        result={name:"main",commit:{sha:observedHead}};
      }
      if(result===null){blockedExternal++;await route.abort();return;}
      await route.fulfill({status:200,contentType:"application/json",
        headers:{"access-control-allow-origin":"*","cache-control":"no-store"},
        body:JSON.stringify(result)});
    });
    const page=await context.newPage();
    page.on("pageerror",error=>record("PAGE_ERROR_"+safe(error)));
    const bay=page.locator("details.evidence-bay");
    const r20=page.locator("details.r20-council-browser");
    const r20result=r20.locator(".browser-evidence-result");
    const r20status=r20.locator('[role="status"]');
    const inputs=r20.locator('input[type="file"]');
    const submit=r20.getByRole("button",{name:"Corroborate R19 ZIP + GitHub source"});
    async function upload(json,blob) {
      await inputs.nth(0).setInputFiles({name:"r23-mock-review.json",
        mimeType:"application/json",buffer:Buffer.from(JSON.stringify(json))});
      await inputs.nth(1).setInputFiles({name:"r23-mock-original.zip",
        mimeType:"application/zip",buffer:blob});
    }
    const noResult=async()=>{if(await r20result.count())throw Error("PREVIOUS_REVIEW_LEAKED");};
    await check("preview_build_marker",async()=>{
      const response=await page.goto(PREVIEW,{waitUntil:"domcontentloaded",timeout:30000});
      if(!response||response.status()!==200)throw Error("PREVIEW_NOT_HTTP_200");
      await page.locator("header.topbar").waitFor({timeout:12000});
      observedSha=await page.getByTestId("phimada-deployed-revision")
        .getAttribute("data-build-sha");
      if(observedSha!==expectedSha)throw Error("PREVIEW_SHA_MISMATCH");
    });
    await check("simulated_public_catalog_ready",async()=>{
      await page.waitForFunction(()=>
        document.querySelector(".feed-state")?.textContent?.includes("GITHUB PUBLIC"),
        null,{timeout:18000});
      await page.locator("button.mission-open-button").click();
      await bay.locator("summary").first().click();
      if(!(await bay.evaluate(el=>el.open)))throw Error("AGENTORA_BAY_NOT_OPEN");
    });
    await check("wrong_agentora_import_refused",async()=>{
      await bay.locator(".evidence-bay-upload input[type=file]").nth(0)
        .setInputFiles({name:"r23-r20-review.json",mimeType:"application/json",
          buffer:Buffer.from(JSON.stringify(review))});
      await bay.locator(".evidence-bay-error")
        .filter({hasText:"EVIDENCE_REVIEW_UNTRUSTED_OR_UNSUPPORTED"})
        .waitFor({state:"visible",timeout:12000});
    });
    await check("r22_shortcut_opens_r20",async()=>{
      await page.getByRole("button",{
        name:"Go to R20 Council JSON + R19 ZIP import"
      }).click();
      if(!(await r20.evaluate(el=>el.open)))throw Error("R20_NOT_OPEN");
      if(await inputs.count()!==2)throw Error("R20_INPUT_COUNT");
      if(await r20.getByText("1. R20 local review JSON").count()!==1||
         await r20.getByText("2. Original R19 Actions ZIP").count()!==1)
        throw Error("R20_LABELS_MISSING");
    });
    await check("r20_mock_zip_and_metadata_correlated",async()=>{
      await upload(review,zip);
      await submit.click();
      await r20result.waitFor({state:"visible",timeout:12000});
      const text=await r20result.textContent()||"";
      if(!text.includes("currently observed main SHA")||
         !text.includes("9/9 PASS")||
         !text.includes("Product complete: NO")||
         !text.includes("Merge or dispatch authorized: NO"))
        throw Error("CORRELATION_SUMMARY_MISSING");
    });
    await check("corrupt_zip_refused",async()=>{
      const corrupt=Buffer.from(zip);
      corrupt[corrupt.length-1]^=0xff;
      await upload(review,corrupt);
      await submit.click();
      await page.waitForFunction(()=>
        document.querySelector(".r20-council-browser [role='status']")
          ?.textContent?.includes("Council browser evidence held:"),
        null,{timeout:12000});
      await noResult();
    });
    await check("forged_reviewer_authority_refused",async()=>{
      const forged={...review,merge_authorized:true};
      await inputs.nth(0).setInputFiles({
        name:"r23-forged-review.json",mimeType:"application/json",
        buffer:Buffer.from(JSON.stringify(forged))});
      await page.waitForFunction(()=>
        document.querySelector(".r20-council-browser [role='status']")
          ?.textContent?.includes("R20 reviewer JSON refused."),
        null,{timeout:12000});
      await noResult();
    });
    await check("source_moved_reported_historical",async()=>{
      observedHead=MOVED;
      await upload(review,zip);
      await submit.click();
      await r20result.waitFor({state:"visible",timeout:12000});
      const text=await r20result.textContent()||"";
      if(!text.includes("Historical R19 browser evidence: main has moved"))
        throw Error("MOVED_SHA_NOT_HISTORICAL");
      if(text.includes("currently observed main SHA"))
        throw Error("STALE_SHA_PROMOTED_TO_CURRENT");
    });
    await check("clear_and_reload_discard_reviews",async()=>{
      await r20.getByRole("button",{name:"Clear R20 review"}).click();
      await noResult();
      if(!((await r20status.textContent())||"").includes("No corroborated R19 browser evidence"))
        throw Error("CLEAR_DID_NOT_REMOVE_CORROBORATION");
      observedHead=SOURCE;
      await upload(review,zip);
      await submit.click();
      await r20result.waitFor({state:"visible",timeout:12000});
      await page.reload({waitUntil:"domcontentloaded",timeout:30000});
      await page.locator("button.mission-open-button").click();
      await bay.locator("summary").first().click();
      await page.getByRole("button",{
        name:"Go to R20 Council JSON + R19 ZIP import"
      }).click();
      await noResult();
      if(!((await r20status.textContent())||"").includes("No corroborated R19 browser evidence"))
        throw Error("R20_REVIEW_PERSISTED_AFTER_RELOAD");
    });
    await check("no_external_or_write_requests",async()=>{
      if(unsafeMethods.length)throw Error("WRITE_REQUEST_ATTEMPTED");
      if(!requests.some(x=>x.origin===API))
        throw Error("NO_MOCK_GITHUB_REQUESTS_WERE_EXERCISED");
    });
    await context.close();
  } catch(error){record("R23_"+safe(error));}
  finally{if(browser)await browser.close().catch(()=>{});}
  const passed=observedSha===expectedSha&&
    CHECKS.every(key=>checks[key]==="PASS")&&errors.length===0&&unsafeMethods.length===0;
  return {
    schema:"phimada.r20-preview-import-browser.v0.23",
    state:passed?"MOCKED_R20_IMPORT_BROWSER_CHECKS_PASSED":"MOCKED_R20_IMPORT_BROWSER_CHECKS_FAILED",
    scope:"LOOPBACK_PREVIEW_WITH_MOCKED_GITHUB_API_ONLY",
    inspected_build_sha:expectedSha,
    observed_build_sha:observedSha,
    mock_zip_sha256:hash(zip),
    mock_run_id:MOCK_RUN,
    tests:Object.fromEntries(CHECKS.map(key=>[key,checks[key]||"NOT_RUN"])),
    errors,blocked_external_requests:blockedExternal,
    blocked_write_requests:unsafeMethods.slice(0,10),
    checks_passed:passed,
    real_r19_run_correlated:false,real_artifact_verified:false,
    deployed_site_tested:false,source_authenticated:false,
    scientific_evidence:false,product_complete:false,
    dispatch_authorized:false,merge_authorized:false
  };
}
async function main() {
  const expected=process.env.PREVIEW_SOURCE_SHA;
  if(typeof expected!=="string"||!HEX40.test(expected))throw Error("R23_BUILD_SHA_REQUIRED");
  const out=process.argv[2]||"r23-artifacts/r20-import-browser.json";
  if(process.argv.length>3||!/^r23-artifacts\/[a-zA-Z0-9._-]+\.json$/.test(out))
    throw Error("R23_OUTPUT_PATH_REFUSED");
  const result=await runR23(expected);
  await mkdir(dirname(out),{recursive:true,mode:0o700});
  const f=await open(out,"wx",0o600);
  try{await f.writeFile(JSON.stringify(result,null,2)+"\n");await f.sync();}
  finally{await f.close();}
  process.stdout.write(JSON.stringify({state:result.state,
    passed_tests:Object.values(result.tests).filter(x=>x==="PASS").length,
    total_tests:CHECKS.length,
    real_artifact_verified:false,merge_authorized:false})+"\n");
  process.exitCode=result.checks_passed?0:2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().catch(e=>{process.stderr.write("R23_HELD "+safe(e)+"\n");process.exitCode=1;});
}
