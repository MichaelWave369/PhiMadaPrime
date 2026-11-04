import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PREVIEW_URL,CHECKS,previewSmoke
} from "../scripts/r21_preview_council_browser.mjs";

const script=readFileSync("scripts/r21_preview_council_browser.mjs","utf8");
const workflow=readFileSync(".github/workflows/r21-council-preview.yml","utf8");

test("R21-01 checks use strictly loopback preview, not public GitHub Pages",()=>{
  assert.equal(PREVIEW_URL,"http://127.0.0.1:4173/");
  assert.match(workflow,/--host 127\.0\.0\.1 --port 4173 --strictPort/);
  assert.match(script,/new URL\(PREVIEW_URL\)\.origin/);
  assert.doesNotMatch(script,/michaelwave369\.github\.io/);
});

test("R21-02 actual browser steps cover complete E1 acceptance and failures",()=>{
  assert.deepEqual([...CHECKS],[
    "local_preview_and_build_marker","mission_board_council_disclosure",
    "real_golden_file_import","tampered_receipt_refusal",
    "rehashed_authority_refusal","self_consistent_forgery_held",
    "clear_discards_receipt","reload_discards_receipt",
    "no_external_or_write_requests"
  ]);
  assert.match(script,/page\.goto\(PREVIEW_URL/);
  assert.match(script,/picker\.setInputFiles/);
  assert.match(script,/fixture_sha256|synthetic_fixture_sha256/);
});

test("R21-03 input is the pinned producer-generated public synthetic receipt",()=>{
  const fixture=JSON.parse(readFileSync("tests/fixtures/council-e1-producer-golden.json","utf8"));
  assert.equal(fixture.schema,"nbg-pocketmesh.council-evidence-exchange-e1.v0.1");
  assert.equal(fixture.origin,"SIMULATED");
  assert.equal(fixture.privacy,"PUBLIC_SYNTHETIC");
  assert.equal(fixture.authority,"NONE");
  assert.equal(fixture.receipts.length,3);
});

test("R21-04 no browser-initiated external calls or unsafe HTTP methods are allowed",()=>{
  assert.match(script,/context\.route\("\*\*\/\*"/);
  assert.match(script,/await route\.abort\(\)/);
  assert.match(script,/request\.method\(\)/);
  assert.match(script,/\["GET","HEAD"\]/);
  assert.doesNotMatch(script,/credentials:\s*"include"/);
});

test("R21-05 never treats preview success as deployed/scientific/authorization evidence",()=>{
  for(const phrase of [
    "deployed_pages_tested:false","live_github_run_verified:false",
    "council_source_authenticated:false","council_model_executed:false",
    "scientific_evidence:false","product_verified:false",
    "dispatch_authorized:false","merge_authorized:false"
  ])assert.ok(script.includes(phrase),phrase);
});

test("R21-06 malformed preview SHA refuses before any browser is created",async()=>{
  let calls=0;
  for(const sha of ["main","bad","b".repeat(39),"C".repeat(40),"",null]){
    await assert.rejects(previewSmoke(sha,{launchBrowser:()=>{
      calls++; throw new Error("must not be called");
    }}),/R21_EXACT_PREVIEW_BUILD_SHA_REQUIRED/);
  }
  assert.equal(calls,0);
});

test("R21-07 CI workflow is automatic only on source changes with read-only token",()=>{
  assert.match(workflow,/on:\n  pull_request:/);
  assert.match(workflow,/\n  push:\n    branches: \[main\]/);
  assert.match(workflow,/permissions:\n  contents: read/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/--ignore-scripts/);
  assert.match(workflow,/\$\{\{ github\.sha \}\}/);
  assert.match(workflow,/npm run build/);
  assert.match(workflow,/npx playwright install --with-deps chromium/);
  assert.doesNotMatch(workflow,/\bpages: write\b|\bcontents: write\b/);
});

test("R21-08 CI emits an artifact even when the UI check is red",()=>{
  assert.match(workflow,/actions\/upload-artifact@v4/);
  assert.match(workflow,/if: always\(\)/);
  assert.match(workflow,/r21-artifacts\/council-preview\.json/);
  assert.match(script,/COUNCIL_RUN|R21_PREVIEW_/);
});

test("R21-09 existing manual R19 and artifact-reviewed R20 workflows stay separate",()=>{
  const live=readFileSync(".github/workflows/r19-council-browser.yml","utf8");
  assert.match(live,/on:\n  workflow_dispatch:/);
  assert.match(live,/RUN_PHI_MADA_COUNCIL_BROWSER/);
  assert.doesNotMatch(workflow,/RUN_PHI_MADA_COUNCIL_BROWSER/);
  const current=readFileSync("src/evidence-bay.jsx","utf8");
  assert.match(current,/<CouncilEvidence \/>/);
  assert.match(current,/<R20CouncilBrowserEvidence catalog=\{catalog\} \/>/);
});

test("R21-10 browser runner has no GitHub mutation or subprocess job dispatch",()=>{
  assert.doesNotMatch(script,/\bfetch\s*\(|\bchild_process\b|\bexec\s*\(/);
  assert.doesNotMatch(workflow,/gh pr merge|gh workflow run|git push/);
  assert.match(script,/HELD UNTRUSTED REVIEW ONLY/);
  assert.match(script,/FORGERY_PROMOTED_TO_AUTHORITY/);
});
