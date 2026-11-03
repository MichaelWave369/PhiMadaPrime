// R19 manually triggered deployed-browser E1 fixture acceptance.
// This does not execute the Council, call models, dispatch jobs or write GitHub.
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import {
  BROWSER_SITE, BROWSER_REPO, validateGithubSource
} from "./r12_browser_contract.mjs";
import {
  validateR19Launch, R19_CHECKS, r19Receipt
} from "./r19_council_browser_contract.mjs";

const GOLDEN_BYTES=readFileSync(new URL("../tests/fixtures/council-e1-producer-golden.json",import.meta.url));
const GOLDEN_SHA=createHash("sha256").update(GOLDEN_BYTES).digest("hex");
const API="https://api.github.com/repos/"+BROWSER_REPO;
const sanitize=value=>String(value?.message||value||"UNKNOWN")
  .replace(/[\r\n\t]+/g," ").slice(0,245);

function argumentsFrom(argv) {
  if(argv.length!==6)throw new Error("R19_ARGS_INVALID");
  const parts={};
  for(let i=0;i<argv.length;i+=2) {
    const key=argv[i],value=argv[i+1];
    if(!["--sha","--confirm","--output"].includes(key)||
      Object.hasOwn(parts,key)||!value||value.startsWith("--"))
      throw new Error("R19_ARGS_INVALID");
    parts[key]=value;
  }
  validateR19Launch(parts["--sha"],parts["--confirm"]);
  return {sha:parts["--sha"],output:parts["--output"]};
}
async function getGithub(path) {
  if(path!==""&&path!=="/branches/main")throw new Error("R19_GITHUB_PATH_REFUSED");
  const response=await fetch(API+path,{
    method:"GET",redirect:"error",signal:AbortSignal.timeout(15000),
    headers:{
      Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      "User-Agent":"phimada-r19-council-browser",
      ...(process.env.GITHUB_TOKEN?{Authorization:"Bearer "+process.env.GITHUB_TOKEN}:{})
    }
  });
  if(!response.ok)throw new Error("R19_GITHUB_HTTP_"+response.status);
  const text=await response.text();
  if(text.length>100000)throw new Error("R19_GITHUB_RESPONSE_TOO_LARGE");
  return JSON.parse(text);
}
async function observeSource(sha) {
  const repo=await getGithub("");
  const heads=[await getGithub("/branches/main"),await getGithub("/branches/main")];
  return validateGithubSource(repo,heads,sha);
}
function canonical(value) {
  if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
  if(value!==null&&typeof value==="object")
    return "{"+Object.keys(value).sort().map(k=>
      JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
  return JSON.stringify(value);
}
function sha(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
function resign(packet) {
  for(const rec of packet.receipts) {
    const {receiptSha256:ignored,...unsigned}=rec;
    rec.receiptSha256=sha(unsigned);
  }
  const {exchangeSha256:ignored,...unsigned}=packet;
  packet.exchangeSha256=sha(unsigned);
  return packet;
}

async function browse(expectedSha) {
  let browser=null,beforeSha=null,afterSha=null,deployedSha=null;
  const checks={},errors=[],unsafeRequests=[];
  const capture=error=>{if(errors.length<20)errors.push(sanitize(error));};
  async function check(id,fn) {
    if(!R19_CHECKS.includes(id))throw new Error("R19_UNKNOWN_CHECK");
    try {await fn();checks[id]="PASS";}
    catch(error){checks[id]="FAIL";throw new Error(id+": "+sanitize(error));}
  }
  try {
    beforeSha=await observeSource(expectedSha);
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({
      viewport:{width:1440,height:900},reducedMotion:"reduce",
      serviceWorkers:"block",acceptDownloads:false
    });
    const page=await context.newPage();
    page.on("pageerror",error=>capture("PAGEERROR_"+sanitize(error)));
    page.on("request",request=>{
      if(!["GET","HEAD"].includes(request.method())&&unsafeRequests.length<10)
        unsafeRequests.push(request.method());
    });
    const council=page.locator("details.council-evidence");
    const result=page.locator(".council-evidence-result");
    const status=page.locator(".council-evidence [role=status]");
    const input=page.locator("#phimada-council-e1-file");
    const inspect=page.getByRole("button",{name:"Inspect selected Council receipt"});
    const clear=page.getByRole("button",{name:"Clear review"});
    async function submit(raw) {
      const payload=typeof raw==="string"?Buffer.from(raw,"utf8"):raw;
      await input.setInputFiles({
        name:"council-public-synthetic.json",mimeType:"application/json",buffer:payload
      });
      await inspect.click();
    }
    async function refused() {
      await status.getByText("Council receipt held:",{exact:false})
        .waitFor({state:"visible",timeout:10000});
      if(await result.count())throw new Error("REFUSAL_LEAKED_PREVIOUS_REVIEW");
    }
    await check("page_deployed_sha",async()=>{
      const response=await page.goto(BROWSER_SITE,{
        waitUntil:"domcontentloaded",timeout:45000
      });
      if(!response||response.status()!==200)throw new Error("SITE_HTTP_NOT_200");
      await page.locator("header.topbar").waitFor({timeout:20000});
      deployedSha=await page.getByTestId("phimada-deployed-revision")
        .getAttribute("data-build-sha");
      if(deployedSha!==expectedSha)throw new Error("DEPLOYED_SHA_DIFFERS_FROM_MAIN");
      await page.waitForFunction(()=>
        document.querySelector(".feed-state")?.textContent?.includes("GITHUB PUBLIC"),
        null,{timeout:45000});
    });
    await check("mission_board_and_council_open",async()=>{
      await page.locator("button.mission-open-button").click();
      await page.locator(".missions-board").waitFor({timeout:10000});
      await page.locator("details.evidence-bay > summary").click();
      if(!(await page.locator("details.evidence-bay").evaluate(node=>node.open)))
        throw new Error("EVIDENCE_BAY_CLOSED");
      await council.locator("summary").click();
      if(!(await council.evaluate(node=>node.open)))throw new Error("COUNCIL_CLOSED");
      if(await input.count()!==1)throw new Error("MISSING_COUNCIL_INPUT");
    });
    await check("golden_receipt_display",async()=>{
      await submit(GOLDEN_BYTES);
      await result.waitFor({state:"visible",timeout:10000});
      const output=(await result.textContent())||"";
      for(const term of [
        "fleet-interop-synthetic-001","ThinkTank","PocketBrain","Vessie",
        "HELD UNTRUSTED REVIEW ONLY","Source authenticated: NO",
        "Scientific evidence: NO","Dispatch/merge authority: NONE"
      ])if(!output.includes(term))throw new Error("REVIEW_TERM_MISSING_"+term.replace(/\s/g,"_"));
      if(await result.locator("li").count()!==3)throw new Error("COUNCIL_SEAT_COUNT");
    });
    await check("tampered_receipt_refused",async()=>{
      const packet=JSON.parse(GOLDEN_BYTES.toString("utf8"));
      packet.receipts[0].sourceSha="f".repeat(40);
      await submit(JSON.stringify(packet));
      await refused();
    });
    await check("rehashed_authority_refused",async()=>{
      const packet=JSON.parse(GOLDEN_BYTES.toString("utf8"));
      packet.executionAuthorized=true;
      await submit(JSON.stringify(resign(packet)));
      await refused();
    });
    await check("self_consistent_forgery_untrusted",async()=>{
      const packet=JSON.parse(GOLDEN_BYTES.toString("utf8"));
      packet.receipts.forEach(r=>{r.sourceSha="b".repeat(40);});
      await submit(JSON.stringify(resign(packet)));
      await result.waitFor({state:"visible",timeout:10000});
      const output=await result.textContent();
      if(!output?.includes("Source authenticated: NO")||
         !output?.includes("Dispatch/merge authority: NONE"))
         throw new Error("SELF_CONSISTENT_PACKET_PROMOTED_TO_AUTHORITY");
    });
    await check("clear_restores_empty",async()=>{
      await clear.click();
      await result.waitFor({state:"hidden",timeout:10000});
      const value=await status.textContent();
      if(!value?.includes("No Council receipt imported"))
        throw new Error("CLEAR_STILL_SHOWS_REVIEW");
    });
    await check("reload_discards_review",async()=>{
      await submit(GOLDEN_BYTES);
      await result.waitFor({state:"visible",timeout:10000});
      await page.reload({waitUntil:"domcontentloaded"});
      await page.locator("header.topbar").waitFor({timeout:15000});
      await page.locator("button.mission-open-button").click();
      await page.locator("details.evidence-bay > summary").click();
      await council.locator("summary").click();
      if(await result.count()!==0)throw new Error("REVIEW_PERSISTED_ACROSS_RELOAD");
      if(!((await status.textContent())||"").includes("No Council receipt imported"))
        throw new Error("REVIEW_STATE_PERSISTED_ACROSS_RELOAD");
    });
    await check("no_write_requests_observed",async()=>{
      if(unsafeRequests.length)throw new Error("WRITE_REQUEST_FROM_UI");
    });
    await context.close();
  } catch(error) {
    capture("COUNCIL_RUN_"+sanitize(error));
  } finally {
    if(browser)await browser.close().catch(()=>{});
    try {afterSha=await observeSource(expectedSha);}
    catch(error){capture("POSTFLIGHT_"+sanitize(error));}
  }
  return r19Receipt({
    expectedSha,beforeSha,afterSha,deployedSha,
    fixtureSha:GOLDEN_SHA,checks,errors:errors.slice(0,20),
    observedUtc:new Date().toISOString(),
    runId:process.env.GITHUB_RUN_ID||null
  });
}
async function main() {
  const {sha,output}=argumentsFrom(process.argv.slice(2));
  const report=await browse(sha);
  await mkdir(dirname(output),{recursive:true,mode:0o700});
  const file=await open(output,"wx",0o600);
  try {await file.writeFile(JSON.stringify(report,null,2)+"\n");await file.sync();}
  finally {await file.close();}
  process.stdout.write(JSON.stringify({
    state:report.state,source_sha:report.source_sha,
    passed_checks:Object.values(report.checks).filter(v=>v==="PASS").length,
    total_checks:R19_CHECKS.length,
    source_authenticated:false,product_verified:false,merge_authorized:false
  })+"\n");
  process.exitCode=report.automated_council_browser_checks_passed?0:2;
}
main().catch(error=>{
  process.stderr.write("R19_HELD "+sanitize(error)+"\n");
  process.exitCode=1;
});
