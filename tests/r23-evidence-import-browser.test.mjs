import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runR23 } from "../scripts/r23_preview_r20_import_browser.mjs";

const runner=readFileSync("scripts/r23_preview_r20_import_browser.mjs","utf8");
const workflow=readFileSync(".github/workflows/r21-council-preview.yml","utf8");
const bay=readFileSync("src/evidence-bay.jsx","utf8");
const r20=readFileSync("src/r20-council-browser-evidence.jsx","utf8");

test("R23-01 invalid build marker fails before launching a browser",async()=>{
  let opened=0;
  for(const sha of ["main",null,"a".repeat(39),"G".repeat(40),42]) {
    await assert.rejects(runR23(sha,{launchBrowser:()=>{
      opened++;throw Error("BROWSER_NOT_EXPECTED");
    }}),/R23_BUILD_SHA_REQUIRED/);
  }
  assert.equal(opened,0);
});

test("R23-02 exactly scoped R20 ZIP/JSON browser inputs, not Agentora R0.7",()=>{
  assert.match(runner,/\.evidence-bay-upload input\[type=file\]/);
  assert.match(runner,/EVIDENCE_REVIEW_UNTRUSTED_OR_UNSUPPORTED/);
  assert.match(runner,/Go to R20 Council JSON \+ R19 ZIP import/);
  assert.match(runner,/details\.r20-council-browser/);
  assert.match(runner,/r20\.locator\('input\[type="file"\]'\)/);
  assert.match(bay,/AGENTORA R0\.7 \/ R0\.6 IMPORT ONLY/);
  assert.match(r20,/Corroborate R19 ZIP \+ GitHub source/);
});

test("R23-03 generates an actual ZIP-format mock and hashes it independently",()=>{
  assert.match(runner,/0x04034b50/);
  assert.match(runner,/0x02014b50/);
  assert.match(runner,/0x06054b50/);
  assert.match(runner,/function crc32\(buf\)/);
  assert.match(runner,/function mockZip\(\)/);
  assert.match(runner,/createHash\("sha256"\)/);
});

test("R23-04 mock repo/run identifiers are explicit and never impersonate a real run",()=>{
  assert.match(runner,/R23_MOCK_ONLY_NOT_A_REAL_R19_ACTIONS_RUN/);
  assert.match(runner,/MOCK_RUN = 41777777777/);
  assert.match(runner,/MOCK_ARTIFACT = 13579/);
  assert.match(runner,/LOOPBACK_PREVIEW_WITH_MOCKED_GITHUB_API_ONLY/);
  assert.match(runner,/real_r19_run_correlated:false/);
  assert.match(runner,/real_artifact_verified:false/);
  assert.match(runner,/deployed_site_tested:false/);
});

test("R23-05 simulated GitHub access limited to a fixed set of GET routes",()=>{
  assert.match(runner,/context\.route\("\*\*\/\*"/);
  assert.match(runner,/\["GET","HEAD"\]\.includes\(method\)/);
  assert.match(runner,/url\.origin===new URL\(PREVIEW\)\.origin/);
  assert.match(runner,/url\.origin!==API/);
  assert.match(runner,/await route\.abort\(\)/);
  assert.match(runner,/await route\.fulfill\(/);
  assert.match(runner,/access-control-allow-origin/);
  assert.doesNotMatch(runner,/\bfetch\s*\(|\bexec\s*\(/);
});

test("R23-06 browser checks all four major UI states",()=>{
  for(const phrase of [
    "r20_mock_zip_and_metadata_correlated",
    "corrupt_zip_refused",
    "forged_reviewer_authority_refused",
    "source_moved_reported_historical",
    "clear_and_reload_discard_reviews"
  ])assert.ok(runner.includes(phrase),phrase);
});

test("R23-07 reported historical state cannot be misclassified as current",()=>{
  assert.match(runner,/observedHead=MOVED/);
  assert.match(runner,/Historical R19 browser evidence: main has moved/);
  assert.match(runner,/STALE_SHA_PROMOTED_TO_CURRENT/);
});

test("R23-08 corrupt ZIP and forged reviewer grant must refuse",()=>{
  assert.match(runner,/corrupt\[corrupt\.length-1\]\^=0xff/);
  assert.match(runner,/merge_authorized:true/);
  assert.match(runner,/R20 reviewer JSON refused\./);
  assert.match(runner,/Council browser evidence held:/);
  assert.match(runner,/PREVIOUS_REVIEW_LEAKED/);
});

test("R23-09 in-tab R20 evidence disappears after Clear and reload",()=>{
  assert.match(runner,/Clear R20 review/);
  assert.match(runner,/No corroborated R19 browser evidence/);
  assert.match(runner,/page\.reload/);
  assert.match(runner,/R20_REVIEW_PERSISTED_AFTER_RELOAD/);
});

test("R23-10 no merging, dispatch, scientific authority or actual GitHub corroboration",()=>{
  for(const name of [
    "source_authenticated:false",
    "scientific_evidence:false",
    "product_complete:false",
    "dispatch_authorized:false",
    "merge_authorized:false"
  ]) assert.ok(runner.includes(name),name);
  assert.doesNotMatch(runner,/gh pr merge|gh workflow run|git push/);
});

test("R23-11 new workflow reuses R21 browser and loopback with separate artifact",()=>{
  assert.match(workflow,/scripts\/r23_preview_r20_import_browser\.mjs/);
  assert.match(workflow,/scripts\/r21_preview_council_browser\.mjs/);
  assert.match(workflow,/127\.0\.0\.1 --port 4173 --strictPort/);
  assert.match(workflow,/r23-artifacts\/r20-import-browser\.json/);
  assert.match(workflow,/phimada-r23-local-r20-import/);
  assert.match(workflow,/if: always\(\)/);
  assert.match(workflow,/permissions:\n  contents: read/);
});

test("R23-12 existing R19 live workflow stays operator-triggered only",()=>{
  const manual=readFileSync(".github/workflows/r19-council-browser.yml","utf8");
  assert.match(manual,/on:\n  workflow_dispatch:/);
  assert.match(manual,/RUN_PHI_MADA_COUNCIL_BROWSER/);
  assert.doesNotMatch(workflow,/RUN_PHI_MADA_COUNCIL_BROWSER/);
});
