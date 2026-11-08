// R40 · Offline verification-gate simulator.
// This module never executes tests, reads live CI, authenticates a source,
// approves a review, or produces an actionable verification receipt.
import {z} from "zod";
import {inspectPipeline} from "./verified-pipeline.mjs";

export const SYNTHETIC_TARGET=Object.freeze({
  repository:"synthetic.invalid/BTM",
  head_sha:"a".repeat(40),
  command:"npm test",
  run_id:"SYNTHETIC-RUN-001"
});
export const SYNTHETIC_SCENARIOS=Object.freeze([
  {id:"sample_pass",label:"Synthetic complete test",detail:"All modeled checks agree; still not real CI"},
  {id:"missing_receipt",label:"Missing receipt",detail:"No run evidence was submitted"},
  {id:"failed_tests",label:"Failed test",detail:"Simulated command exited with failure"},
  {id:"pending_run",label:"Pending run",detail:"No completion or exit result"},
  {id:"head_moved",label:"Wrong commit",detail:"Receipt refers to a different commit"},
  {id:"not_executed",label:"Test never ran",detail:"A success claim without execution"},
  {id:"wrong_repository",label:"Wrong repository",detail:"Receipt is from another target"},
  {id:"forged_authority",label:"Forged authority",detail:"Receipt attempts to claim approval"},
  {id:"fake_verification",label:"Forged verified label",detail:"An untrusted verified flag is injected"},
  {id:"inconsistent_exit",label:"Inconsistent exit code",detail:"Reported success with a nonzero exit"}
]);
const REPO=z.string().trim().min(1).max(128);
const sha=z.string().regex(/^[a-f0-9]{40}$/);
export const syntheticReceiptSchema=z.strictObject({
  kind:z.literal("PHI_SYNTHETIC_CI_FIXTURE_V1"),
  provenance:z.literal("BUILT_IN_SYNTHETIC_FIXTURE_NOT_REAL"),
  simulation_only:z.literal(true),
  pipeline_id:z.string().min(1).max(64),
  repository:REPO,
  head_sha:sha,
  run_id:z.literal(SYNTHETIC_TARGET.run_id),
  command:z.string().trim().min(1).max(128),
  attempted:z.boolean(),
  completed:z.boolean(),
  outcome:z.enum(["success","failure","pending","not_run"]),
  exit_code:z.number().int().min(0).max(255).nullable(),
  claims_real_verification:z.literal(false),
  approval:z.strictObject({
    human_approved:z.literal(false),
    permissions:z.array(z.string()).length(0)
  })
});

export function syntheticFixture(pipelineId="btm-ci-review"){
  return {
    kind:"PHI_SYNTHETIC_CI_FIXTURE_V1",
    provenance:"BUILT_IN_SYNTHETIC_FIXTURE_NOT_REAL",
    simulation_only:true,
    pipeline_id:pipelineId,
    repository:SYNTHETIC_TARGET.repository,
    head_sha:SYNTHETIC_TARGET.head_sha,
    run_id:SYNTHETIC_TARGET.run_id,
    command:SYNTHETIC_TARGET.command,
    attempted:true,
    completed:true,
    outcome:"success",
    exit_code:0,
    claims_real_verification:false,
    approval:{human_approved:false,permissions:[]}
  };
}

export function fixtureForScenario(scenarioId,pipelineId="btm-ci-review"){
  const fixture=syntheticFixture(pipelineId);
  switch(scenarioId){
    case "sample_pass":return fixture;
    case "missing_receipt":return null;
    case "failed_tests":return {...fixture,outcome:"failure",exit_code:1};
    case "pending_run":return {...fixture,completed:false,outcome:"pending",exit_code:null};
    case "head_moved":return {...fixture,head_sha:"b".repeat(40)};
    case "not_executed":return {...fixture,attempted:false};
    case "wrong_repository":return {...fixture,repository:"synthetic.invalid/Other"};
    case "forged_authority":return {...fixture,approval:{human_approved:true,permissions:["merge"]}};
    case "fake_verification":return {...fixture,claims_real_verification:true};
    case "inconsistent_exit":return {...fixture,exit_code:17};
    default:throw new Error("Unknown synthetic scenario");
  }
}

function gate(id,label,ok,explanation){
  return {id,label,ok,explanation};
}
function baseReport(scenarioId,designResult){
  return {
    report_kind:"PHI_SYNTHETIC_GATE_REPORT_V1",
    mode:"OFFLINE_SYNTHETIC_ONLY",
    scenario_id:scenarioId,
    state:"SIMULATED_GATE_HELD",
    synthetic_gate_accepted:false,
    actual_ci_verified:false,
    actual_tests_executed:false,
    authentic_source_verified:false,
    human_review_completed:false,
    merge_authorized:false,
    permissions:[],
    execution_status:"NOT_RUN_IN_THIS_APP",
    design_state:designResult.state,
    checks:[],
    issues:[],
    notice:"SYNTHETIC FIXTURE ONLY. This app did not execute tests or check GitHub. A simulated pass is NOT real verification or permission."
  };
}

/** Accepts arbitrary objects only as SYNTHETIC fixtures; never grants authority. */
export function inspectSyntheticReceipt(design,receipt,scenarioId="custom_synthetic"){
  const designResult=inspectPipeline(design);
  const report=baseReport(scenarioId,designResult);
  report.checks.push(gate("design","Graph design is valid",designResult.valid,
    "A valid diagram does not certify execution."));
  if(!designResult.valid){
    report.state="SIMULATED_DESIGN_HELD";
    report.issues.push("The pipeline design has unresolved schema or topology errors");
    return report;
  }
  if(receipt===null||receipt===undefined){
    report.checks.push(gate("receipt","Synthetic receipt present",false,"No receipt to inspect"));
    report.issues.push("Missing synthetic receipt");
    return report;
  }
  const parsed=syntheticReceiptSchema.safeParse(receipt);
  if(!parsed.success){
    report.checks.push(gate("contract","Strict synthetic fixture contract",false,
      "Malformed or authority-claiming fields are refused"));
    report.issues.push("Fixture schema invalid, provenance unsupported or authority fields forged");
    return report;
  }
  const item=parsed.data;
  const checks=[
    gate("contract","Strict synthetic fixture contract",true,
      "Only a clearly labeled built-in-style synthetic fixture was parsed"),
    gate("pipeline","Pipeline ID binding",item.pipeline_id===design.pipeline_id,
      "Fixture must name the currently selected pipeline"),
    gate("repository","Repository matches synthetic target",
      item.repository===SYNTHETIC_TARGET.repository,
      "A different repository cannot satisfy this exercise"),
    gate("head","Exact synthetic commit SHA matches",
      item.head_sha===SYNTHETIC_TARGET.head_sha,
      "An execution receipt for another commit is not acceptable"),
    gate("command","Expected synthetic test command",
      item.command===SYNTHETIC_TARGET.command,
      "The expected test command must match exactly"),
    gate("attempted","Fixture records an attempted test",item.attempted===true,
      "A success claim without a test run is not accepted"),
    gate("completed","Fixture records a completed test",item.completed===true,
      "Unfinished tests cannot pass a gate"),
    gate("outcome","Fixture result and exit code agree",
      item.outcome==="success"&&item.exit_code===0,
      "Pending, failed or contradictory results are held")
  ];
  report.checks.push(...checks);
  report.issues.push(...checks.filter(c=>!c.ok).map(c=>c.explanation));
  report.synthetic_gate_accepted=report.issues.length===0;
  report.state=report.synthetic_gate_accepted?
    "SIMULATED_GATE_ACCEPTED":"SIMULATED_GATE_HELD";
  return report;
}

export function runSyntheticScenario(design,scenarioId){
  if(!SYNTHETIC_SCENARIOS.some(x=>x.id===scenarioId)){
    const report=baseReport(scenarioId,inspectPipeline(design));
    report.issues.push("Unknown scenario; no simulation performed");
    return report;
  }
  return inspectSyntheticReceipt(
    design,fixtureForScenario(scenarioId,design?.pipeline_id),scenarioId
  );
}
