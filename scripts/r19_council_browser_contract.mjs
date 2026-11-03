// R19: narrowly scoped, manually invoked Chromium Council E1 browser acceptance.
// A passing receipt reports browser interactions at an observed SHA, not a
// cryptographic deployment attestation, authentic producer, or job authority.
import {
  BROWSER_REPO, BROWSER_REPO_ID, BROWSER_SITE
} from "./r12_browser_contract.mjs";

export const R19_CONFIRM="RUN_PHI_MADA_COUNCIL_BROWSER";
export const R19_SCHEMA="phimada.council-live-browser.v0.19";
export const R19_CHECKS=Object.freeze([
  "page_deployed_sha",
  "mission_board_and_council_open",
  "golden_receipt_display",
  "tampered_receipt_refused",
  "rehashed_authority_refused",
  "self_consistent_forgery_untrusted",
  "clear_restores_empty",
  "reload_discards_review",
  "no_write_requests_observed"
]);
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
function requireValid(condition,code){ if(!condition)throw new Error(code); }
export function validateR19Launch(sourceSha, confirmation) {
  requireValid(typeof sourceSha==="string"&&HEX40.test(sourceSha),
    "R19_EXACT_SOURCE_SHA_REQUIRED");
  requireValid(confirmation===R19_CONFIRM,"R19_TYPED_CONFIRMATION_REQUIRED");
  return sourceSha;
}
export function r19Receipt({
  expectedSha,beforeSha,afterSha,deployedSha,fixtureSha,
  checks={},errors=[],observedUtc,runId=null
}) {
  requireValid(typeof expectedSha==="string"&&HEX40.test(expectedSha),
    "R19_EXACT_SOURCE_SHA_REQUIRED");
  requireValid(typeof observedUtc==="string"&&
    Number.isFinite(Date.parse(observedUtc)),"R19_TIME_INVALID");
  requireValid(typeof fixtureSha==="string"&&HEX64.test(fixtureSha),
    "R19_FIXTURE_HASH_INVALID");
  requireValid(runId===null||(typeof runId==="string"&&/^[0-9]{1,20}$/.test(runId)),
    "R19_RUN_INVALID");
  requireValid(Array.isArray(errors)&&errors.length<=20&&
    errors.every(x=>typeof x==="string"&&x.length<=260),"R19_ERRORS_INVALID");
  requireValid(checks!==null&&typeof checks==="object"&&!Array.isArray(checks)&&
    Object.keys(checks).every(k=>R19_CHECKS.includes(k))&&
    Object.values(checks).every(x=>["PASS","FAIL","NOT_RUN"].includes(x)),
    "R19_CHECK_FIELDS_INVALID");
  const recorded=Object.fromEntries(R19_CHECKS.map(k=>[k,checks[k]??"NOT_RUN"]));
  const sourceMatches=beforeSha===expectedSha&&afterSha===expectedSha;
  const deployedMatches=deployedSha===expectedSha;
  const checksPass=R19_CHECKS.every(k=>recorded[k]==="PASS");
  const passed=sourceMatches&&deployedMatches&&checksPass&&errors.length===0;
  const state=!sourceMatches?"HELD_GITHUB_SOURCE_CHANGED_OR_UNKNOWN":
    !deployedMatches?"HELD_DEPLOYED_SHA_MARKER_MISMATCH":
    !checksPass?"FAILED_OR_INCOMPLETE_COUNCIL_BROWSER_CHECKS":
    errors.length?"HELD_BROWSER_RUNTIME_ERRORS":
    "COUNCIL_BROWSER_INTERACTIONS_PASSED_AT_OBSERVED_SHA";
  return {
    schema:R19_SCHEMA,state,repository:BROWSER_REPO,repository_id:BROWSER_REPO_ID,
    target_url:BROWSER_SITE,source_sha:expectedSha,
    github_head_before_sha:beforeSha||null,
    github_head_after_sha:afterSha||null,
    observed_deployment_build_marker:deployedSha||null,
    source_fixture_schema:"nbg-pocketmesh.council-evidence-exchange-e1.v0.1",
    fixture_sha256:fixtureSha,
    fixture_origin:"PUBLIC_SYNTHETIC",
    fixture_source_authenticated:false,
    council_consumer_execution_observed:false,
    council_model_executed:false,
    council_review_state:"HELD_UNTRUSTED_REVIEW_ONLY",
    checks:recorded,browser_runtime_errors:errors,
    observed_utc:observedUtc,workflow_run_id:runId,
    automated_council_browser_checks_passed:passed,
    deployed_revision_cryptographically_attested:false,
    source_independent:false,
    scientific_evidence:false,
    accessibility_conformance_verified:false,
    product_verified:false,verified_complete:false,
    dispatch_authorized:false,merge_authorized:false,
    operator_review_required:true
  };
}
