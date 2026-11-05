import test from "node:test";
import assert from "node:assert/strict";
import {
  COUNCIL_SEATS,selectCouncilSeat,r36EvidenceSummary,
  verifyAgentoraCouncilEvidence,councilProvenanceSnapshot,councilProvenanceHandoff
} from "../src/council-provenance.mjs";

const source="a".repeat(40),tested="b".repeat(40),merged="c".repeat(40);
const validR10={
  status:"R10_SIGNATURE_VALID_INSPECTION_ONLY",signatureValid:true,
  keyPinned:true,sourceReplayConsistent:true,authority:"NONE",
  permissions:[],actionAllowed:false,issuerId:"synthetic.issuer",
  model:"synthetic-model"
};
function live(override={}){
  return {
    observation:"LIVE_GITHUB_RECORDS_CORRELATED",
    repository:"MichaelWave369/Agentora",prNumber:88,
    sourceSha:source,testedSha:tested,mergeSha:null,
    state:"AUTOMATED_CHECKS_PASSED",projectVerifiedComplete:false,
    prUrl:"https://github.com/MichaelWave369/Agentora/pull/88",
    runUrl:"https://github.com/MichaelWave369/Agentora/actions/runs/123456",
    checks:[{name:"backend (3.12)",conclusion:"success"},
      {name:"backend (3.13)",conclusion:"success"},
      {name:"web",conclusion:"success"}],
    taskId:"r1-docs-20261105",repairAttempts:0,
    outstandingAcceptance:["Verify deployed interface"],
    ...override
  };
}
const read=fixture=>async n=>{assert.equal(n,88);return fixture;};

test("R37 uses the exact four primary operators and five Ori roles without duplication",()=>{
  assert.equal(COUNCIL_SEATS.length,9);
  assert.equal(new Set(COUNCIL_SEATS.map(s=>s.id)).size,9);
  assert.equal(COUNCIL_SEATS.filter(s=>s.team==="PRIMARY_OPERATORS").length,4);
  assert.equal(COUNCIL_SEATS.filter(s=>s.team==="ORI_COUNCIL").length,5);
  assert.equal(selectCouncilSeat("guardian-ori").name,"Guardian Ori");
  assert.throws(()=>selectCouncilSeat("evil-admin"),/R37_UNKNOWN_SEAT/);
});

test("R37 retains only categorical R10 signing status; never promotes model identity",()=>{
  const valid=r36EvidenceSummary(validR10);
  assert.equal(valid.category,"R10_PINNED_SYNTHETIC_PASSPORT");
  assert.equal(valid.modelLabel,"synthetic-model");
  assert.equal(valid.modelExecutionProven,false);
  assert.equal(valid.councilSeatAuthenticated,false);
  assert.equal(valid.sourceToAgentoraBound,false);
  const denied=r36EvidenceSummary({...validR10,authority:"WRITE"});
  assert.equal(denied.category,"NO_VERIFIED_R10_SIGNATURE");
  assert.equal(r36EvidenceSummary(null).category,"NO_VERIFIED_R10_SIGNATURE");
});

test("R37 reuses a trusted reader's exact R1 tested SHA result (not input source)",async()=>{
  const record=await verifyAgentoraCouncilEvidence("88",tested,{reader:read(live())});
  assert.equal(record.status,"GITHUB_AGENTORA_R1_OUTPUT_CORRELATED");
  assert.equal(record.relation,"VERIFIED_TESTED_PR_HEAD");
  assert.equal(record.ownerWorkflowCorroborated,true);
  assert.equal(record.sourceToR10PassportBound,false);
  assert.equal(record.agentModelIdentityVerified,false);
  assert.equal(record.inferenceProven,false);
  assert.equal(record.authority,"NONE");
  assert.deepEqual(record.permissions,[]);
  assert.equal(record.actionAllowed,false);
});

test("R37 requires original independently corroborated merge SHA",async()=>{
  const record=await verifyAgentoraCouncilEvidence("88",merged,{reader:read(live({
    state:"MERGED",mergeSha:merged
  }))});
  assert.equal(record.relation,"VERIFIED_MERGE_COMMIT");
  await assert.rejects(verifyAgentoraCouncilEvidence("88",merged,{reader:read(live())}),
    /R37_OUTPUT_NOT_CORRELATED/);
});

test("R37 rejects invalid PR and SHA before any GitHub request",async()=>{
  let called=0;
  const reader=async()=>{called++;return live();};
  for(const bad of ["0","1;evil","-1","88 ","","9999999999999"]){
    await assert.rejects(verifyAgentoraCouncilEvidence(bad,tested,{reader}),/R37_PR_NUMBER/);
  }
  for(const bad of [source.toUpperCase(),source.slice(0,12),"0".repeat(64),"",null]){
    // Uppercase isn't distinct for all 'a'; always rejected by lower-case SHA.
    await assert.rejects(verifyAgentoraCouncilEvidence("88",bad,{reader}),/R37_OUTPUT_SHA/);
  }
  assert.equal(called,0);
});

test("R37 refuses source/input SHA masquerading as verified worker output",async()=>{
  await assert.rejects(verifyAgentoraCouncilEvidence("88",source,{reader:read(live())}),
    /R37_OUTPUT_NOT_CORRELATED/);
  await assert.rejects(verifyAgentoraCouncilEvidence("88",source,{reader:read(live({
    testedSha:source
  }))}),/R37_INPUT_IS_NOT_OUTPUT/);
});

test("R37 rejects foreign repo, PR mismatch, fake completion, forged claims and missing named checks",async()=>{
  const changes=[
    {repository:"other/Agentora"},
    {prNumber:99},
    {observation:"USER_UPLOADED_RECEIPT"},
    {projectVerifiedComplete:true},
    {prUrl:"https://github.com/attacker/Agentora/pull/88"},
    {runUrl:"https://evil.example/123456"},
    {checks:[{name:"web",conclusion:"success"}]},
    {checks:[{name:"backend (3.12)",conclusion:"success"},
      {name:"backend (3.13)",conclusion:"success"},{name:"web",conclusion:"failure"}]},
    {state:"MERGED",mergeSha:null},
    {state:"AUTOMATED_CHECKS_PASSED",mergeSha:merged}
  ];
  for(const change of changes){
    await assert.rejects(
      verifyAgentoraCouncilEvidence("88",tested,{reader:read(live(change))}),
      /R37_(TRUSTED_RETURN_SHAPE|MERGE_STATE)/,
      JSON.stringify(change));
  }
});

test("R37 council review keeps independent proofs unjoined even with both valid",async()=>{
  const record=await verifyAgentoraCouncilEvidence("88",tested,{reader:read(live())});
  const snap=councilProvenanceSnapshot("vessie",validR10,record);
  assert.equal(snap.schema,"phimada.council-provenance-review.v0.37");
  assert.equal(snap.agentora.category,"LIVE_GITHUB_R1_OUTPUT_CORRELATED");
  assert.equal(snap.r10.category,"R10_PINNED_SYNTHETIC_PASSPORT");
  assert.equal(snap.crossSourceBinding,"NONE");
  assert.equal(snap.modelIdentity,"NOT_PROVEN");
  assert.equal(snap.councilExecution,"NOT_PROVEN");
  assert.equal(snap.realModelInference,"NOT_PROVEN");
  assert.equal(snap.authority,"NONE");
  assert.equal(snap.actionAllowed,false);
  const handoff=councilProvenanceHandoff(snap);
  assert.match(handoff,/Cross-source R10 to Agentora binding: NONE/);
  assert.match(handoff,/Seat identity: NOT AUTHENTICATED/);
  assert.doesNotMatch(handoff,/synthetic.issuer|synthetic-model/);
  const forged=structuredClone(snap);forged.humanAuthorizationGranted=true;
  assert.throws(()=>councilProvenanceHandoff(forged),/R37_UNSAFE_HANDOFF/);
});

test("R37 never invents an existing R1 run when none was corroborated",()=>{
  const snap=councilProvenanceSnapshot("brainc",null,{status:"USER_CLAIM",
    repo:"MichaelWave369/Agentora",authority:"NONE",actionAllowed:false,
    agentModelIdentityVerified:false,sourceToR10PassportBound:false});
  assert.equal(snap.agentora.category,"NOT_CORRELATED");
  assert.equal(snap.r10.category,"NO_VERIFIED_R10_SIGNATURE");
  assert.equal(snap.authority,"NONE");
});
