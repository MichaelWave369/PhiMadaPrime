// R21: real Chromium integration against the ephemeral local Vite preview.
// Uses one fixed public-synthetic PocketMesh packet and denies browser network.
// This is NOT a live Pages test, source attestation, Council execution, or approval.
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PREVIEW_URL = "http://127.0.0.1:4173/";
export const CHECKS = Object.freeze([
  "local_preview_and_build_marker",
  "mission_board_council_disclosure",
  "real_golden_file_import",
  "tampered_receipt_refusal",
  "rehashed_authority_refusal",
  "self_consistent_forgery_held",
  "clear_discards_receipt",
  "reload_discards_receipt",
  "no_external_or_write_requests"
]);
const SHA40 = /^[a-f0-9]{40}$/;
const INPUT = readFileSync(new URL("../tests/fixtures/council-e1-producer-golden.json", import.meta.url));
const INPUT_SHA = createHash("sha256").update(INPUT).digest("hex");

function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k =>
      JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}
function hash(obj) {
  return createHash("sha256").update(canonical(obj)).digest("hex");
}
function resign(packet) {
  for (const seat of packet.receipts) {
    const { receiptSha256:ignored, ...data } = seat;
    seat.receiptSha256 = hash(data);
  }
  const { exchangeSha256:ignored, ...unsigned } = packet;
  packet.exchangeSha256 = hash(unsigned);
  return packet;
}
function sanitize(error) {
  return String(error?.message || error || "UNKNOWN")
    .replace(/[\r\n\t]+/g, " ").slice(0, 220);
}
function requiredSha(value) {
  if (typeof value !== "string" || !SHA40.test(value))
    throw new Error("R21_EXACT_PREVIEW_BUILD_SHA_REQUIRED");
  return value;
}
function boundedReceipt({buildSha,observedSha,checks,errors,methodViolations,externalBlocked}) {
  const passed = observedSha === buildSha &&
    CHECKS.every(key => checks[key] === "PASS") &&
    errors.length === 0 && methodViolations.length === 0;
  return {
    schema:"phimada.council-preview-browser.v0.21",
    state:passed?"ISOLATED_PREVIEW_CHROMIUM_CHECKS_PASSED":
      "ISOLATED_PREVIEW_CHROMIUM_CHECKS_FAILED_OR_INCOMPLETE",
    scope:"EPHEMERAL_LOCAL_CI_PREVIEW_ONLY",
    inspected_source_sha:buildSha,
    observed_preview_build_marker:observedSha||null,
    synthetic_fixture_sha256:INPUT_SHA,
    checks:Object.fromEntries(CHECKS.map(k=>[k,checks[k]||"NOT_RUN"])),
    errors:errors.slice(0,15),
    blocked_external_requests:externalBlocked,
    unsafe_request_methods:methodViolations.slice(0,10),
    browser_interactions_passed:passed,
    deployed_pages_tested:false,
    live_github_run_verified:false,
    council_source_authenticated:false,
    council_model_executed:false,
    scientific_evidence:false,
    product_verified:false,
    dispatch_authorized:false,
    merge_authorized:false,
    operator_review_required:true
  };
}
export async function previewSmoke(expectedSha, { launchBrowser = () => chromium.launch({headless:true}) }={}) {
  requiredSha(expectedSha);
  let browser=null,observedSha=null,externalBlocked=0;
  const checks={},errors=[],methodViolations=[];
  const recordError=error=>{
    if (errors.length<15) errors.push(sanitize(error));
  };
  async function check(id,fn) {
    if (!CHECKS.includes(id)) throw new Error("R21_UNKNOWN_CHECK");
    try { await fn(); checks[id]="PASS"; }
    catch(error) {
      checks[id]="FAIL";
      throw new Error(id+": "+sanitize(error));
    }
  }
  try {
    browser=await launchBrowser();
    const context=await browser.newContext({
      viewport:{width:1440,height:900},
      reducedMotion:"reduce",serviceWorkers:"block",acceptDownloads:false
    });
    await context.route("**/*", async route=>{
      const request=route.request();
      if (!["GET","HEAD"].includes(request.method()) &&
          methodViolations.length < 10) methodViolations.push(request.method());
      if (new URL(request.url()).origin !== new URL(PREVIEW_URL).origin) {
        externalBlocked++;
        await route.abort();
      } else if (!["GET","HEAD"].includes(request.method())) {
        await route.abort();
      } else {
        await route.continue();
      }
    });
    const page=await context.newPage();
    page.on("pageerror",error=>recordError("PAGEERROR_"+sanitize(error)));
    const status=page.locator(".council-evidence [role='status']");
    const result=page.locator(".council-evidence-result");
    const picker=page.locator("#phimada-council-e1-file");
    const inspect=page.getByRole("button",{name:"Inspect selected Council receipt"});
    const clear=page.getByRole("button",{name:"Clear review"});
    async function importFixture(packet) {
      await picker.setInputFiles({
        name:"public-synthetic-e1.json",mimeType:"application/json",
        buffer:typeof packet==="string" ? Buffer.from(packet,"utf8") : packet
      });
      await inspect.click();
    }
    async function assertRefused() {
      await page.waitForFunction(()=>
        document.querySelector(".council-evidence [role='status']")
          ?.textContent?.includes("Council receipt held:"),
        null,{timeout:12000});
      if (await result.count()) throw new Error("REFUSAL_STILL_SHOWS_REVIEW");
    }
    await check("local_preview_and_build_marker", async()=>{
      const response=await page.goto(PREVIEW_URL,{
        waitUntil:"domcontentloaded",timeout:30000
      });
      if (!response || response.status()!==200) throw new Error("PREVIEW_HTTP_NOT_200");
      await page.locator("header.topbar").waitFor({timeout:15000});
      observedSha=await page.getByTestId("phimada-deployed-revision")
        .getAttribute("data-build-sha");
      if (observedSha!==expectedSha) throw new Error("LOCAL_BUILD_MARKER_MISMATCH");
    });
    await check("mission_board_council_disclosure",async()=>{
      await page.locator("button.mission-open-button").click();
      await page.locator(".missions-board").waitFor({timeout:10000});
      await page.locator("details.evidence-bay > summary").click();
      const bay=page.locator("details.evidence-bay");
      if (!(await bay.evaluate(el=>el.open))) throw new Error("EVIDENCE_BAY_NOT_OPEN");
      await page.getByRole("button",{
        name:"Go to R20 Council JSON + R19 ZIP import"
      }).click();
      const routed=page.locator("#phimada-r20-council-browser");
      if (!(await routed.evaluate(el=>el.open)))
        throw new Error("R20_IMPORT_ROUTER_FAILED_TO_OPEN");
      if (await routed.getByText("1. R20 local review JSON").count()!==1 ||
          await routed.getByText("2. Original R19 Actions ZIP").count()!==1)
        throw new Error("R20_IMPORT_ROUTER_WRONG_FILE_FIELDS");
      await page.locator("details.council-evidence > summary").click();
      const council=page.locator("details.council-evidence");
      if (!(await council.evaluate(el=>el.open))) throw new Error("COUNCIL_NOT_OPEN");
      if (await picker.count()!==1) throw new Error("COUNCIL_PICKER_MISSING");
    });
    await check("real_golden_file_import",async()=>{
      await importFixture(INPUT);
      await result.waitFor({state:"visible",timeout:12000});
      const text=await result.textContent()||"";
      for(const word of ["fleet-interop-synthetic-001","ThinkTank","PocketBrain",
        "Vessie","HELD UNTRUSTED REVIEW ONLY","Source authenticated: NO",
        "Dispatch/merge authority: NONE"]) {
        if (!text.includes(word)) throw new Error("REVIEW_FIELD_MISSING_"+word.slice(0,36));
      }
      if (await result.locator("li").count()!==3) throw new Error("REVIEW_SEAT_COUNT");
    });
    await check("tampered_receipt_refusal",async()=>{
      const packet=JSON.parse(INPUT.toString("utf8"));
      packet.receipts[0].sourceSha="f".repeat(40);
      await importFixture(JSON.stringify(packet));
      await assertRefused();
    });
    await check("rehashed_authority_refusal",async()=>{
      const packet=JSON.parse(INPUT.toString("utf8"));
      packet.executionAuthorized=true;
      await importFixture(JSON.stringify(resign(packet)));
      await assertRefused();
    });
    await check("self_consistent_forgery_held",async()=>{
      const packet=JSON.parse(INPUT.toString("utf8"));
      packet.receipts.forEach(seat=>{seat.sourceSha="b".repeat(40);});
      await importFixture(JSON.stringify(resign(packet)));
      await result.waitFor({state:"visible",timeout:12000});
      const text=await result.textContent()||"";
      if (!text.includes("Source authenticated: NO") ||
          !text.includes("Dispatch/merge authority: NONE"))
        throw new Error("FORGERY_PROMOTED_TO_AUTHORITY");
    });
    await check("clear_discards_receipt",async()=>{
      await clear.click();
      await result.waitFor({state:"hidden",timeout:10000});
      if (!((await status.textContent())||"").includes("No Council receipt imported"))
        throw new Error("CLEAR_PRESERVED_REVIEW");
    });
    await check("reload_discards_receipt",async()=>{
      await importFixture(INPUT);
      await result.waitFor({state:"visible",timeout:12000});
      await page.reload({waitUntil:"domcontentloaded",timeout:30000});
      await page.locator("header.topbar").waitFor({timeout:15000});
      await page.locator("button.mission-open-button").click();
      await page.locator("details.evidence-bay > summary").click();
      await page.locator("details.council-evidence > summary").click();
      if (await result.count()) throw new Error("REVIEW_PERSISTED_AFTER_RELOAD");
      if (!((await status.textContent())||"").includes("No Council receipt imported"))
        throw new Error("REVIEW_STATUS_PERSISTED_AFTER_RELOAD");
    });
    await check("no_external_or_write_requests",async()=>{
      if (methodViolations.length) throw new Error("UNEXPECTED_NON_READ_REQUEST_METHOD");
    });
    await context.close();
  } catch(error) {
    recordError("R21_PREVIEW_"+sanitize(error));
  } finally {
    if (browser) await browser.close().catch(()=>{});
  }
  return boundedReceipt({
    buildSha:expectedSha,observedSha,checks,errors,methodViolations,externalBlocked
  });
}

async function main() {
  const expectedSha=requiredSha(process.env.PREVIEW_SOURCE_SHA);
  const report=await previewSmoke(expectedSha);
  const path=process.argv[2]||"r21-artifacts/council-preview.json";
  if (process.argv.length>3 || !/^r21-artifacts\/[a-zA-Z0-9._-]+\.json$/.test(path))
    throw new Error("R21_FIXED_OUTPUT_PATH_REQUIRED");
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  const fd=await open(path,"wx",0o600);
  try {await fd.writeFile(JSON.stringify(report,null,2)+"\n");await fd.sync();}
  finally {await fd.close();}
  process.stdout.write(JSON.stringify({
    state:report.state,
    passed_checks:Object.values(report.checks).filter(x=>x==="PASS").length,
    total_checks:CHECKS.length,
    external_requests_blocked:report.blocked_external_requests,
    deployed_pages_tested:false,merge_authorized:false
  })+"\n");
  process.exitCode=report.browser_interactions_passed?0:2;
}
if (process.argv[1] && import.meta.url===
    pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e=>{process.stderr.write("R21_HELD "+sanitize(e)+"\n");process.exitCode=1;});
}
