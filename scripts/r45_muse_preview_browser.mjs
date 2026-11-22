// R45 Muse adapter: real Chromium on an ephemeral loopback-only preview.
// This tests the built UI with synthetic, disposable Node-generated Ed25519
// keys, NOT a real Muse signature or live GitHub evidence.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import {mkdir,open} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {PROVENANCE_DOMAIN} from "../src/verified-pipeline-signed-provenance.mjs";

export const PREVIEW_URL="http://127.0.0.1:4173/";
export const CHECKS=Object.freeze([
  "exact_candidate_preview",
  "open_r45_through_thinktank",
  "wrong_public_key_fingerprint_refused",
  "synthetic_signature_verified_without_issuer_trust",
  "tampered_signature_refused",
  "reset_and_reload_discard_local_material",
  "no_external_network_or_write_requests"
]);
const digest=x=>createHash("sha256").update(x).digest("hex");
const guard=e=>String(e?.message||e||"UNKNOWN").replace(/[\r\n\t]+/g," ").slice(0,200);
function fixture(){
  const pair=generateKeyPairSync("ed25519"); // never committed, used only in this process
  const spki=pair.publicKey.export({type:"spki",format:"der"});
  const raw=spki.subarray(12);
  const publicKey="ed25519:"+raw.toString("base64url");
  const museFingerprint="sha256:"+digest(raw);
  const keyId="sha256:"+digest(spki);
  const issuerId="musehub:synthetic-browser";
  const repository="MichaelWave369/BTM";
  const observedAt=new Date(Date.now()-2*60_000).toISOString();
  const signedAt=new Date(Date.now()-60_000).toISOString();
  const report=JSON.stringify({
    schema:"gmed-report:v1",state:"GMED",merged:true,
    sha:"a".repeat(40),
    counts:{total:1,passed:1,accepted:1,failed:0,pending:0,unknown:0},
    checks:[{name:"Synthetic check",kind:"check",status:"completed",
      conclusion:"success",grade:"good",url:null}],
    pullUrl:"https://github.com/MichaelWave369/BTM/pull/51",
    title:"SYNTHETIC ONLY",number:51,observedAt,
    detail:"Synthetic browser fixture, no CI executed",
    limits:"Never evidence of an actual GitHub run",
    target:{owner:"MichaelWave369",repo:"BTM",fullName:repository,number:51,
      url:"https://github.com/MichaelWave369/BTM/pull/51"}
  });
  const claim=JSON.stringify({
    format:"phi.gmed.provenance-claim.v1",
    scope:"GMED_V1_REPORT_DIGEST_ONLY",repository,pr_number:51,
    merge_sha:"a".repeat(40),report_sha256:digest(Buffer.from(report,"utf8")),
    observed_at:observedAt,authority:"NONE",permissions:[]
  });
  const claimBase64=Buffer.from(claim,"utf8").toString("base64");
  const message=[PROVENANCE_DOMAIN,issuerId,keyId,signedAt,claimBase64,""].join("\n");
  const signature=sign(null,Buffer.from(message,"utf8"),pair.privateKey);
  const envelope={
    format:"phi.gmed.signed-provenance.v1",algorithm:"Ed25519",
    issuer_id:issuerId,key_id:keyId,signed_at:signedAt,claim_base64:claimBase64,
    signature_base64:signature.toString("base64")
  };
  // The keypair stays scoped to fixture(), never exported or written.
  return {report,publicKey,museFingerprint,issuerId,repository,envelope};
}
function receipt(expectedSha,observedSha,checks,errors,external,unsafe){
  const passed=observedSha===expectedSha&&CHECKS.every(k=>checks[k]==="PASS")&&
    !errors.length&&!unsafe.length;
  return {
    schema:"phimada.r45-muse-browser-preview.v1",
    status:passed?"SYNTHETIC_CHROMIUM_PASS":"SYNTHETIC_CHROMIUM_HELD",
    scope:"ISOLATED_CI_CANDIDATE_ONLY",
    expected_source_sha:expectedSha,observed_build_sha:observedSha||null,
    checks:Object.fromEntries(CHECKS.map(k=>[k,checks[k]||"NOT_RUN"])),
    errors:errors.slice(0,8),blocked_external_requests:external,
    unsafe_request_methods:unsafe.slice(0,8),
    real_muse_identity_tested:false,real_muse_signer_tested:false,
    external_identity_authenticated:false,
    real_gmed_execution_proven:false,deployed_pages_tested:false,
    permissions:[],agent_executed:false,delegation_granted:false,
    merge_authorized:false,deploy_authorized:false,
    operator_acceptance_required:true
  };
}
export async function runMusePreview(expectedSha,{
  launchBrowser=()=>chromium.launch({headless:true})
}={}){
  if(!/^[a-f0-9]{40}$/.test(expectedSha||""))
    throw Error("R45_EXACT_CANDIDATE_SHA_REQUIRED");
  let browser,observedSha=null,external=0;
  const checks={},errors=[],unsafe=[];
  async function check(name,fn){
    try{await fn();checks[name]="PASS";}
    catch(e){checks[name]="FAIL";throw Error(name+": "+guard(e));}
  }
  try{
    const sample=fixture();
    browser=await launchBrowser();
    const context=await browser.newContext({
      viewport:{width:1400,height:900},reducedMotion:"reduce",
      serviceWorkers:"block",acceptDownloads:false
    });
    await context.route("**/*",async route=>{
      const req=route.request(),url=new URL(req.url());
      if(!["GET","HEAD"].includes(req.method())) unsafe.push(req.method());
      if(url.origin!==new URL(PREVIEW_URL).origin){
        external++;await route.abort();
      }else if(!["GET","HEAD"].includes(req.method())){
        await route.abort();
      }else await route.continue();
    });
    const page=await context.newPage();
    page.on("pageerror",e=>errors.push("PAGE_ERROR_"+guard(e)));
    const desk=page.locator("section.vpl-root");
    const gate=desk.locator("section.vpsig-root");
    const helper=gate.locator("details.vpsig-muse");
    const file=(name,body)=>({name,mimeType:"application/json",
      buffer:Buffer.from(body,"utf8")});
    const envelopeInput=gate.locator(".vpsig-fields input[type=file]").first();
    const helperFields=helper.locator("input[type=text]");
    const useKey=helper.getByRole("button",{name:"Use public key as local R45 pin"});
    const inspect=gate.getByRole("button",{name:"Inspect signed provenance"});
    const clear=gate.getByRole("button",{name:"Clear signature files and result"});
    await check("exact_candidate_preview",async()=>{
      const resp=await page.goto(PREVIEW_URL,{waitUntil:"domcontentloaded",timeout:30000});
      assert.equal(resp?.status(),200);
      observedSha=await page.getByTestId("phimada-deployed-revision")
        .getAttribute("data-build-sha");
      assert.equal(observedSha,expectedSha,"Candidate source marker mismatch");
    });
    await check("open_r45_through_thinktank",async()=>{
      await page.locator("nav.side-tabs").getByRole("button",{name:"ThinkTank"}).click();
      await page.getByRole("navigation",{name:"ThinkTank rooms"})
        .getByRole("button",{name:"Pipeline Factory"}).click();
      await desk.waitFor({state:"visible",timeout:15000});
      await desk.getByLabel("GMED report JSON").setInputFiles(
        file("r45-synthetic-report.json",sample.report));
      await gate.getByText("Signed provenance gate").waitFor({state:"visible"});
      await helper.locator("summary").click();
      await helperFields.nth(0).fill(sample.publicKey);
      await helperFields.nth(1).fill("sha256:"+"0".repeat(64));
      await helperFields.nth(2).fill(sample.issuerId);
      await helperFields.nth(3).fill(sample.repository);
    });
    await check("wrong_public_key_fingerprint_refused",async()=>{
      await useKey.click();
      await helper.getByRole("alert").waitFor({state:"visible",timeout:7000});
      assert.match(await helper.getByRole("alert").textContent(),/do not match/);
      assert.equal(await gate.locator(".vpsig-result").count(),0);
    });
    await check("synthetic_signature_verified_without_issuer_trust",async()=>{
      await helperFields.nth(1).fill(sample.museFingerprint);
      await useKey.click();
      await helper.getByRole("status").waitFor({state:"visible",timeout:7000});
      await envelopeInput.setInputFiles(
        file("r45-synthetic-envelope.json",JSON.stringify(sample.envelope)));
      await inspect.click();
      await gate.locator(".vpsig-result").waitFor({state:"visible",timeout:15000});
      const output=await gate.locator(".vpsig-result").textContent()||"";
      assert.match(output,/SIGNATURE VALID UNAUTHENTICATED ISSUER/);
      assert.match(output,/Issuer identity authenticated by this app\s*NO/);
      assert.match(output,/Merge\/deployment authorization\s*NONE/);
    });
    await check("tampered_signature_refused",async()=>{
      const envelope={...sample.envelope};
      const signature=Buffer.from(envelope.signature_base64,"base64");
      signature[0]^=1;
      envelope.signature_base64=signature.toString("base64");
      await envelopeInput.setInputFiles(file("r45-tampered-envelope.json",
        JSON.stringify(envelope)));
      await inspect.click();
      await gate.locator(".vpsig-result").waitFor({state:"visible",timeout:15000});
      const output=await gate.locator(".vpsig-result").textContent()||"";
      assert.match(output,/INVALID SIGNATURE/);
      assert.match(output,/Ed25519 signature mathematically valid\s*NO/);
      assert.doesNotMatch(output,/SIGNATURE VALID UNAUTHENTICATED ISSUER/);
    });
    await check("reset_and_reload_discard_local_material",async()=>{
      await clear.click();
      assert.equal(await helperFields.nth(0).inputValue(),"");
      assert.equal(await helperFields.nth(1).inputValue(),"");
      assert.equal(await gate.locator(".vpsig-result").count(),0);
      await page.reload({waitUntil:"domcontentloaded",timeout:30000});
      await page.locator("nav.side-tabs").getByRole("button",{name:"ThinkTank"}).click();
      await page.getByRole("navigation",{name:"ThinkTank rooms"})
        .getByRole("button",{name:"Pipeline Factory"}).click();
      assert.equal(await page.locator("section.vpl-root .vpsig-result").count(),0);
      assert.equal(await page.locator("section.vpl-root input[type=file]").first()
        .evaluate(el=>el.files?.length||0),0);
    });
    await check("no_external_network_or_write_requests",async()=>{
      assert.deepEqual(unsafe,[]);
    });
    await context.close();
  }catch(e){
    errors.push(guard(e));
  }finally{
    await browser?.close().catch(()=>{});
  }
  return receipt(expectedSha,observedSha,checks,errors,external,unsafe);
}
async function main(){
  const sha=process.env.PREVIEW_SOURCE_SHA;
  const target=process.argv[2]||"r45-muse-artifacts/browser-preview.json";
  if(process.argv.length>3||!/^r45-muse-artifacts\/[A-Za-z0-9._-]+\.json$/.test(target))
    throw Error("R45_FIXED_ARTIFACT_PATH_REQUIRED");
  const result=await runMusePreview(sha);
  await mkdir(dirname(target),{recursive:true,mode:0o700});
  const f=await open(target,"wx",0o600);
  try{await f.writeFile(JSON.stringify(result,null,2)+"\n");await f.sync();}
  finally{await f.close();}
  console.log(JSON.stringify({status:result.status,
    passed:Object.values(result.checks).filter(x=>x==="PASS").length,
    total:CHECKS.length,real_muse_identity_tested:false}));
  process.exitCode=result.status==="SYNTHETIC_CHROMIUM_PASS"?0:2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().catch(e=>{console.error("R45_MUSE_PREVIEW_HELD "+guard(e));process.exitCode=1;});
}
