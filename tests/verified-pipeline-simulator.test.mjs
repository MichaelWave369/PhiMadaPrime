import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pipelineTemplate} from "../src/verified-pipeline.mjs";
import {
  SYNTHETIC_TARGET,SYNTHETIC_SCENARIOS,syntheticFixture,
  fixtureForScenario,inspectSyntheticReceipt,runSyntheticScenario
} from "../src/verified-pipeline-simulator.mjs";

const design=()=>pipelineTemplate();
const run=id=>runSyntheticScenario(design(),id);

test("R2 simulated success never becomes real-world verification",()=>{
  const report=run("sample_pass");
  assert.equal(report.report_kind,"PHI_SYNTHETIC_GATE_REPORT_V1");
  assert.equal(report.mode,"OFFLINE_SYNTHETIC_ONLY");
  assert.equal(report.state,"SIMULATED_GATE_ACCEPTED");
  assert.equal(report.synthetic_gate_accepted,true);
  assert.equal(report.actual_ci_verified,false);
  assert.equal(report.actual_tests_executed,false);
  assert.equal(report.authentic_source_verified,false);
  assert.equal(report.human_review_completed,false);
  assert.equal(report.merge_authorized,false);
  assert.equal(report.execution_status,"NOT_RUN_IN_THIS_APP");
  assert.deepEqual(report.permissions,[]);
  assert.match(report.notice,/SYNTHETIC FIXTURE ONLY/);
  assert.ok(report.checks.every(x=>x.ok));
});

test("R2 missing receipt is held, never assumed green",()=>{
  const r=run("missing_receipt");
  assert.equal(r.synthetic_gate_accepted,false);
  assert.equal(r.state,"SIMULATED_GATE_HELD");
  assert.match(r.issues.join(" "),/Missing synthetic receipt/);
});

test("R2 failed simulated tests are held",()=>{
  const r=run("failed_tests");
  assert.equal(r.synthetic_gate_accepted,false);
  assert.match(r.issues.join(" "),/Pending, failed or contradictory/);
});

test("R2 pending tests with no exit result are held",()=>{
  const r=run("pending_run");
  assert.equal(r.synthetic_gate_accepted,false);
  assert.ok(r.checks.some(x=>x.id==="completed"&&!x.ok));
  assert.ok(r.checks.some(x=>x.id==="outcome"&&!x.ok));
});

test("R2 exact SHA mismatch never counts as matching test evidence",()=>{
  const r=run("head_moved");
  assert.equal(r.synthetic_gate_accepted,false);
  assert.ok(r.checks.some(x=>x.id==="head"&&!x.ok));
});

test("R2 success claim without test execution is rejected",()=>{
  const r=run("not_executed");
  assert.equal(r.synthetic_gate_accepted,false);
  assert.ok(r.checks.some(x=>x.id==="attempted"&&!x.ok));
});

test("R2 receipt scoped to another repository is rejected",()=>{
  const r=run("wrong_repository");
  assert.equal(r.synthetic_gate_accepted,false);
  assert.ok(r.checks.some(x=>x.id==="repository"&&!x.ok));
});

test("R2 forged approval, permissions, and real-verification fields fail schema",()=>{
  for(const id of ["forged_authority","fake_verification"]){
    const r=run(id);
    assert.equal(r.state,"SIMULATED_GATE_HELD");
    assert.equal(r.synthetic_gate_accepted,false);
    assert.ok(r.checks.some(x=>x.id==="contract"&&!x.ok));
    assert.equal(r.merge_authorized,false);
    assert.equal(r.actual_ci_verified,false);
  }
});

test("R2 nonzero exit code contradicting success is held",()=>{
  const r=run("inconsistent_exit");
  assert.equal(r.synthetic_gate_accepted,false);
  assert.ok(r.checks.some(x=>x.id==="outcome"&&!x.ok));
});

test("R2 every advertised synthetic scenario runs deterministically",()=>{
  assert.equal(SYNTHETIC_SCENARIOS.length,10);
  const seen=new Set();
  for(const {id} of SYNTHETIC_SCENARIOS){
    assert.equal(seen.has(id),false);
    seen.add(id);
    assert.deepEqual(run(id),run(id));
    assert.equal(run(id).actual_tests_executed,false);
    assert.equal(run(id).human_review_completed,false);
    assert.equal(run(id).merge_authorized,false);
    assert.deepEqual(run(id).permissions,[]);
    assert.equal(run(id).synthetic_gate_accepted,id==="sample_pass");
  }
});

test("R2 invalid pipeline graph stops even the synthetic exercise",()=>{
  const p=design();
  p.edges.push({id:"bypass",source:"request",target:"result"});
  const result=runSyntheticScenario(p,"sample_pass");
  assert.equal(result.state,"SIMULATED_DESIGN_HELD");
  assert.equal(result.synthetic_gate_accepted,false);
  assert.ok(result.issues.some(x=>/design/.test(x)));
});

test("R2 claimed arbitrary receipt source and extra authority flags are rejected",()=>{
  const p=design(),fake=syntheticFixture(p.pipeline_id);
  fake.provenance="GITHUB_SIGNED";
  assert.equal(inspectSyntheticReceipt(p,fake).synthetic_gate_accepted,false);
  fake.provenance="BUILT_IN_SYNTHETIC_FIXTURE_NOT_REAL";
  fake.real_ci_run_url="https://github.com/example/fake";
  assert.equal(inspectSyntheticReceipt(p,fake).synthetic_gate_accepted,false);
});

test("R2 unexpected pipeline ID refuses even structurally successful fixture",()=>{
  const p=design(),fake=syntheticFixture("someone-else");
  const result=inspectSyntheticReceipt(p,fake);
  assert.equal(result.synthetic_gate_accepted,false);
  assert.ok(result.checks.some(x=>x.id==="pipeline"&&!x.ok));
});

test("R2 malformed run ID or missing execution fields are rejected",()=>{
  const p=design(),f=syntheticFixture(p.pipeline_id);
  f.run_id="REAL-RUN-42";
  assert.equal(inspectSyntheticReceipt(p,f).state,"SIMULATED_GATE_HELD");
  delete f.run_id;
  assert.equal(inspectSyntheticReceipt(p,f).synthetic_gate_accepted,false);
});

test("R2 mismatched expected command and target is held",()=>{
  const p=design(),f=syntheticFixture(p.pipeline_id);
  f.command="echo success";
  assert.equal(inspectSyntheticReceipt(p,f).synthetic_gate_accepted,false);
  f.command=SYNTHETIC_TARGET.command;
  f.head_sha="f".repeat(40);
  assert.equal(inspectSyntheticReceipt(p,f).synthetic_gate_accepted,false);
});

test("R2 fake labels and nonexistent scenario never acquire authority",()=>{
  const result=run("invented-real-ci-success");
  assert.equal(result.synthetic_gate_accepted,false);
  assert.equal(result.actual_ci_verified,false);
  assert.equal(result.human_review_completed,false);
  assert.equal(result.merge_authorized,false);
});

test("R2 simulator is integrated into existing R1 Pipeline Factory",()=>{
  const shell=readFileSync(new URL("../src/verified-pipeline.jsx",import.meta.url),"utf8");
  const sim=readFileSync(new URL("../src/verified-pipeline-simulator.jsx",import.meta.url),"utf8");
  assert.match(shell,/SyntheticGateLab/);
  assert.match(sim,/Run offline simulation/);
  assert.match(sim,/Changing the pipeline requires a fresh evaluation/);
  assert.match(sim,/REAL-WORLD VERIFICATION: NOT PERFORMED/);
  for(const feature of ["setLastRun","lastRun?.design===design","scenario==="]){
    assert.ok(sim.includes(feature));
  }
});

test("R2 simulator has no network, persistence, or tool execution code",()=>{
  const source=readFileSync(new URL("../src/verified-pipeline-simulator.jsx",import.meta.url),"utf8");
  assert.doesNotMatch(source,/fetch\s*\(|WebSocket\s*\(|localStorage|sessionStorage|eval\s*\(|dangerouslySetInnerHTML/);
  const core=readFileSync(new URL("../src/verified-pipeline-simulator.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(core,/fetch\s*\(|WebSocket\s*\(|child_process|execSync|spawn\s*\(/);
});

test("R2 snapshots are synthetic data, never real GitHub identifiers",()=>{
  assert.match(SYNTHETIC_TARGET.repository,/\.invalid\//);
  assert.match(SYNTHETIC_TARGET.run_id,/^SYNTHETIC-/);
  const fixture=fixtureForScenario("sample_pass");
  assert.equal(fixture.simulation_only,true);
  assert.equal(fixture.claims_real_verification,false);
  assert.equal(fixture.approval.human_approved,false);
});
