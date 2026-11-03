import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  R19_CONFIRM, R19_SCHEMA, R19_CHECKS,
  validateR19Launch, r19Receipt
} from "../scripts/r19_council_browser_contract.mjs";

const SHA="a".repeat(40), MOVED="b".repeat(40);
const fixtureBytes=readFileSync("tests/fixtures/council-e1-producer-golden.json");
const FIXTURE_SHA=createHash("sha256").update(fixtureBytes).digest("hex");
const NOW="2026-11-03T23:00:00.000Z";
const checks=Object.fromEntries(R19_CHECKS.map(name=>[name,"PASS"]));
function receipt(extra={}) {
  return r19Receipt({
    expectedSha:SHA,beforeSha:SHA,afterSha:SHA,deployedSha:SHA,
    fixtureSha:FIXTURE_SHA,checks,errors:[],observedUtc:NOW,runId:"41777777777",
    ...extra
  });
}

test("R19-01 exact SHA and typed human confirmation required",()=>{
  assert.equal(validateR19Launch(SHA,R19_CONFIRM),SHA);
  for(const bad of ["main","ABC".repeat(13)+"x","a".repeat(39),null])
    assert.throws(()=>validateR19Launch(bad,R19_CONFIRM),/R19_EXACT_SOURCE_SHA_REQUIRED/);
  for(const phrase of ["","yes","RUN_PHI_MADA_BROWSER_SMOKE",true])
    assert.throws(()=>validateR19Launch(SHA,phrase),/R19_TYPED_CONFIRMATION_REQUIRED/);
});

test("R19-02 complete observed browser checks are limited to reviewed SHA",()=>{
  const r=receipt();
  assert.equal(r.schema,R19_SCHEMA);
  assert.equal(r.state,"COUNCIL_BROWSER_INTERACTIONS_PASSED_AT_OBSERVED_SHA");
  assert.equal(r.automated_council_browser_checks_passed,true);
  assert.equal(r.source_sha,SHA);
  assert.deepEqual(Object.keys(r.checks),[...R19_CHECKS]);
  assert.equal(r.fixture_sha256,FIXTURE_SHA);
});

test("R19-03 source move before or after testing blocks clean result",()=>{
  for(const change of [{beforeSha:MOVED},{afterSha:MOVED},
    {beforeSha:null},{afterSha:null}]) {
    const r=receipt(change);
    assert.equal(r.state,"HELD_GITHUB_SOURCE_CHANGED_OR_UNKNOWN");
    assert.equal(r.automated_council_browser_checks_passed,false);
  }
});

test("R19-04 deployed build marker mismatch blocks green",()=>{
  const r=receipt({deployedSha:MOVED});
  assert.equal(r.state,"HELD_DEPLOYED_SHA_MARKER_MISMATCH");
  assert.equal(r.automated_council_browser_checks_passed,false);
  assert.equal(r.deployed_revision_cryptographically_attested,false);
});

test("R19-05 every required browser check fails closed on missing or failed",()=>{
  for(const key of R19_CHECKS) {
    for(const value of ["FAIL", "NOT_RUN"]) {
      const r=receipt({checks:{...checks,[key]:value}});
      assert.equal(r.state,"FAILED_OR_INCOMPLETE_COUNCIL_BROWSER_CHECKS",key);
      assert.equal(r.automated_council_browser_checks_passed,false,key);
    }
    const partial={...checks}; delete partial[key];
    assert.equal(receipt({checks:partial}).checks[key],"NOT_RUN");
    assert.equal(receipt({checks:partial}).automated_council_browser_checks_passed,false);
  }
});

test("R19-06 browser runtime errors block reported acceptance",()=>{
  const r=receipt({errors:["PAGEERROR_One scripted error"]});
  assert.equal(r.state,"HELD_BROWSER_RUNTIME_ERRORS");
  assert.equal(r.automated_council_browser_checks_passed,false);
});

test("R19-07 receipts never authorize merges, execution or claim independent science",()=>{
  const r=receipt();
  for(const key of ["fixture_source_authenticated",
    "council_consumer_execution_observed","council_model_executed",
    "deployed_revision_cryptographically_attested","source_independent",
    "scientific_evidence","accessibility_conformance_verified",
    "product_verified","verified_complete","dispatch_authorized","merge_authorized"]) {
    assert.equal(r[key],false,key);
  }
  assert.equal(r.operator_review_required,true);
  assert.equal(r.fixture_origin,"PUBLIC_SYNTHETIC");
  assert.equal(r.council_review_state,"HELD_UNTRUSTED_REVIEW_ONLY");
});

test("R19-08 bogus check names, statuses and runtime errors are refused",()=>{
  assert.throws(()=>receipt({checks:{...checks,approve:"PASS"}}),/R19_CHECK_FIELDS_INVALID/);
  assert.throws(()=>receipt({checks:{...checks,page_deployed_sha:"MAYBE"}}),/R19_CHECK_FIELDS_INVALID/);
  assert.throws(()=>receipt({errors:["x".repeat(261)]}),/R19_ERRORS_INVALID/);
  assert.throws(()=>receipt({errors:Array(21).fill("FAIL")}),/R19_ERRORS_INVALID/);
  assert.throws(()=>receipt({runId:"bad"}),/R19_RUN_INVALID/);
  assert.throws(()=>receipt({fixtureSha:"fake"}),/R19_FIXTURE_HASH_INVALID/);
});

test("R19-09 fixed golden receipt is the E1-D source-pinned public synthetic fixture",()=>{
  const p=JSON.parse(fixtureBytes.toString("utf8"));
  assert.equal(p.caseId,"fleet-interop-synthetic-001");
  assert.equal(p.schema,"nbg-pocketmesh.council-evidence-exchange-e1.v0.1");
  assert.equal(p.origin,"SIMULATED");
  assert.equal(p.privacy,"PUBLIC_SYNTHETIC");
  assert.equal(p.sourceProvenance,"DECLARED_UNVERIFIED");
  assert.equal(p.authority,"NONE");
  assert.equal(p.receipts.length,3);
  assert.equal(p.executionAuthorized,false);
  assert.equal(p.mergeAuthorized,false);
  assert.equal(p.sharingAuthorized,false);
});

test("R19-10 R12 file check counts ONLY original two Agentora pilot uploads",()=>{
  const source=readFileSync("scripts/r12_browser_smoke.mjs","utf8");
  assert.match(source,/bay\.locator\('\.evidence-bay-upload input\[type="file"\]'\)\.count\(\) !== 2/);
  assert.doesNotMatch(source,/bay\.locator\('input\[type="file"\]'\)\.count\(\) !== 2/);
  const bay=readFileSync("src/evidence-bay.jsx","utf8");
  assert.match(bay,/<CouncilEvidence \/>/);
  assert.match(bay,/<BrowserEvidence catalog=\{catalog\} contract=\{localContract\} \/>/);
});

test("R19-11 live script checks actual synthetic import, tamper, clear and reload",()=>{
  const source=readFileSync("scripts/r19_live_council_browser.mjs","utf8");
  for(const pattern of [
    /getByTestId\("phimada-deployed-revision"\)/,
    /const GOLDEN_BYTES=readFileSync/,
    /page\.locator\("details\.council-evidence"\)/,
    /setInputFiles\(/, /tampered_receipt_refused/,
    /rehashed_authority_refused/, /self_consistent_forgery_untrusted/,
    /clear_restores_empty/, /reload_discards_review/,
    /no_write_requests_observed/,
    /await observeSource\(expectedSha\)/,
    /method:"GET",redirect:"error"/
  ]) assert.match(source,pattern);
  assert.doesNotMatch(source,/\beval\s*\(|\bexec\s*\(/);
});

test("R19-12 manual workflow never launches on PR, push or schedule",()=>{
  const source=readFileSync(".github/workflows/r19-council-browser.yml","utf8");
  assert.match(source,/on:\n  workflow_dispatch:/);
  assert.match(source,/confirmation:/);
  assert.match(source,/source_sha:/);
  assert.match(source,/permissions:\n  contents: read/);
  assert.match(source,/if: github\.event_name == 'workflow_dispatch'/);
  assert.match(source,/upload-artifact@v4/);
  assert.match(source,/if: always\(\)/);
  assert.doesNotMatch(source,/^\s*pull_request:\s*$/m);
  assert.doesNotMatch(source,/^\s*push:\s*$/m);
  assert.doesNotMatch(source,/^\s*schedule:\s*$/m);
});

test("R19-13 browser runner emits bounded and non-authorizing receipt on failure",()=>{
  const r=receipt({checks:{"page_deployed_sha":"PASS"}});
  assert.equal(r.checks.reload_discards_review,"NOT_RUN");
  assert.equal(r.checks.no_write_requests_observed,"NOT_RUN");
  assert.equal(r.automated_council_browser_checks_passed,false);
  assert.equal(r.product_verified,false);
  assert.equal(r.merge_authorized,false);
});

test("R19-14 upstream R14 a11y audit stays separately manual and untouched",()=>{
  const source=readFileSync(".github/workflows/r14-live-accessibility.yml","utf8");
  assert.match(source,/RUN_PHI_MADA_A11Y_AUDIT/);
  assert.match(source,/on:\n  workflow_dispatch:/);
  const r19=readFileSync(".github/workflows/r19-council-browser.yml","utf8");
  assert.doesNotMatch(r19,/axe-core\/playwright/);
});
