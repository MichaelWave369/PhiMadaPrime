import test from "node:test";
import assert from "node:assert/strict";
import {
  turnProvenanceEligible,correlateAgentoraR1Return,
  verifyAgentoraR1ForCommit,r31Handoff
} from "../src/turn-provenance.mjs";
import {TURN_REPO,TURN_REPO_ID} from "../src/autonomous-turn.mjs";

const source="a".repeat(40),tested="b".repeat(40),merged="c".repeat(40);
const repo={id:TURN_REPO_ID,name:"Agentora",full_name:TURN_REPO,exampleOnly:false};
const commit={sha:tested,parentSha:source};
const history={repository:TURN_REPO,repositoryId:TURN_REPO_ID,
  headSha:"d".repeat(40),commits:[commit,{sha:merged,parentSha:source}]};
const bundleFor=(item)=>({
  schema:"phimada.commit-evidence.v0.30",repository:TURN_REPO,
  repositoryId:TURN_REPO_ID,sha:item.sha,parentSha:item.parentSha,
  historyHeadSha:history.headSha,executedByPage:false,mergeAuthorized:false,
  prs:{state:"OBSERVED",prs:[{number:87}]}
});
const result={
  observation:"LIVE_GITHUB_RECORDS_CORRELATED",
  repository:TURN_REPO,prNumber:87,sourceSha:source,testedSha:tested,
  mergeSha:merged,state:"MERGED",projectVerifiedComplete:false,
  taskId:"r1-docs-20261104101010",
  prUrl:"https://github.com/MichaelWave369/Agentora/pull/87",
  runUrl:"https://github.com/MichaelWave369/Agentora/actions/runs/41875250182",
  repairAttempts:0,outstandingAcceptance:["Human acceptance needed"],
  nextAction:"Review remaining acceptance",
  checks:[
    {name:"backend (3.12)",conclusion:"success"},
    {name:"backend (3.13)",conclusion:"success"},
    {name:"web",conclusion:"success"}
  ]
};
test("only the precise public Agentora catalog identity can use R1 verifier",()=>{
  assert.equal(turnProvenanceEligible(repo),true);
  for(const other of [
    {...repo,id:1},{...repo,exampleOnly:true},
    {...repo,name:"Other",full_name:"MichaelWave369/Other"},
    {...repo,full_name:"stranger/Agentora"}
  ])assert.equal(turnProvenanceEligible(other),false);
});
test("R31 corroborates tested PR head only when selected Chronicle SHA matches",()=>{
  const value=correlateAgentoraR1Return(repo,history,commit,bundleFor(commit),87,result);
  assert.equal(value.relation,"VERIFIED_TESTED_PR_HEAD");
  assert.equal(value.state,"LIVE_GITHUB_R1_RETURN_CORRELATED");
  assert.equal(value.ciRequirementNamesCorroborated,true);
  assert.equal(value.ownerApprovalCorroborated,true);
  assert.equal(value.controllerRunCorroborated,true);
  assert.equal(value.productVerifiedComplete,false);
  assert.equal(value.aiModelExecutionProven,false);
  assert.equal(value.agentIdentityAuthenticated,false);
  assert.equal(value.browserExecutedWork,false);
  assert.equal(value.dispatchAuthorized,false);
  assert.equal(value.mergeAuthorized,false);
});
test("matching merge SHA yields verified merge relationship with separate product acceptance",()=>{
  const item={sha:merged,parentSha:source};
  const value=correlateAgentoraR1Return(repo,history,item,bundleFor(item),87,result);
  assert.equal(value.relation,"VERIFIED_MERGE_COMMIT");
  assert.equal(value.mergeReadbackCorroborated,true);
  assert.equal(value.outstandingAcceptance.length,1);
  assert.equal(value.productVerifiedComplete,false);
});
test("source input alone must never be presented as the executing worker's output",()=>{
  const item={sha:source,parentSha:"e".repeat(40)};
  const h={...history,commits:[item]};
  const b={...bundleFor(item)};
  assert.throws(()=>correlateAgentoraR1Return(repo,h,item,b,87,result),
    /R31_SELECTED_COMMIT_NOT_AGENTORA_R1_OUTPUT/);
});
test("unrelated PR, invented repository, bad URLs and incomplete checks all fail closed",()=>{
  const bad=[
    {...result,prNumber:88},
    {...result,repository:"stranger/Agentora"},
    {...result,prUrl:"https://evil.example.com/fake"},
    {...result,runUrl:"https://github.com/MichaelWave369/Agentora/issues/42"},
    {...result,checks:result.checks.slice(0,2)},
    {...result,checks:[...result.checks,{name:"unknown",conclusion:"success"}]},
    {...result,checks:result.checks.map((c,i)=>i?c:{...c,conclusion:"failure"})},
    {...result,projectVerifiedComplete:true},
    {...result,observation:"UNSIGNED_LOCAL_RECEIPT"},
    {...result,state:"MERGED",mergeSha:null}
  ];
  for(const item of bad) assert.throws(()=>
    correlateAgentoraR1Return(repo,history,commit,bundleFor(commit),87,item),
    /R31_(TRUSTED_R1_RESULT_SHAPE|MERGE_STATE_CONFLICT)/);
});
test("Chronicle identity, selected commit and exact R30 evidence binding are mandatory",()=>{
  assert.throws(()=>correlateAgentoraR1Return(repo,{...history,headSha:"f".repeat(40)},
    commit,bundleFor(commit),87,result),/R31_R30_SELECTION_MISMATCH/);
  assert.throws(()=>correlateAgentoraR1Return(repo,{...history,repositoryId:42},
    commit,bundleFor(commit),87,result),/R31_CHRONICLE_SELECTION_MISMATCH/);
  assert.throws(()=>correlateAgentoraR1Return(repo,history,commit,
    {...bundleFor(commit),sha:"f".repeat(40)},87,result),/R31_R30_SELECTION_MISMATCH/);
  assert.throws(()=>correlateAgentoraR1Return(repo,history,commit,
    {...bundleFor(commit),mergeAuthorized:true},87,result),/R31_R30_SELECTION_MISMATCH/);
});
test("read-only bridge validates inputs before invoking a live R1 read",async()=>{
  let reads=0;
  const reader=async number=>{reads++;assert.equal(number,87);return result;};
  for(const number of [0,-1,0.5,NaN])await assert.rejects(
    verifyAgentoraR1ForCommit(repo,history,commit,bundleFor(commit),number,{reader}),
    /R31_PR_NUMBER/);
  assert.equal(reads,0);
  const output=await verifyAgentoraR1ForCommit(repo,history,commit,bundleFor(commit),
    87,{reader});
  assert.equal(reads,1);
  assert.equal(output.selectedSha,tested);
});
test("underlying R1 verifier failures never become trusted correlation",async()=>{
  await assert.rejects(verifyAgentoraR1ForCommit(repo,history,commit,
    bundleFor(commit),87,{reader:async()=>{throw Error("TURN_NO_UNIQUE_GITHUB_RETURN_YET");}}),
    /TURN_NO_UNIQUE_GITHUB_RETURN_YET/);
});
test("PR association page can be absent without forging an association",()=>{
  const b={...bundleFor(commit),prs:{state:"UNAVAILABLE"}};
  const r=correlateAgentoraR1Return(repo,history,commit,b,87,result);
  assert.equal(r.associatedPrInBoundedR30Page,null);
  const other={...bundleFor(commit),prs:{state:"OBSERVED",prs:[]}};
  const z=correlateAgentoraR1Return(repo,history,commit,other,87,result);
  assert.equal(z.associatedPrInBoundedR30Page,false);
});
test("unmerged R1 result is not mistaken for a successful merge",()=>{
  const open={...result,state:"AUTOMATED_CHECKS_PASSED",mergeSha:null};
  const r=correlateAgentoraR1Return(repo,history,commit,bundleFor(commit),87,open);
  assert.equal(r.relation,"VERIFIED_TESTED_PR_HEAD");
  assert.equal(r.mergeReadbackCorroborated,false);
  const item={sha:merged,parentSha:source};
  assert.throws(()=>correlateAgentoraR1Return(repo,history,item,bundleFor(item),87,open),
    /R31_SELECTED_COMMIT_NOT_AGENTORA_R1_OUTPUT/);
});
test("human-readable handoff preserves provenance limits",()=>{
  const correlated=correlateAgentoraR1Return(repo,history,commit,bundleFor(commit),87,result);
  const text=r31Handoff(correlated);
  assert.match(text,/Owner environment approval and GitHub workflow correlated: YES/);
  assert.match(text,/AI model execution proven: NO/);
  assert.match(text,/Product acceptance verified: NO/);
  assert.match(text,new RegExp(tested));
  assert.throws(()=>r31Handoff({...correlated,state:"UNKNOWN"}),/R31_HANDOFF_UNAVAILABLE/);
});
