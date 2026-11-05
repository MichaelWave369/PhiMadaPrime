import test from "node:test";
import assert from "node:assert/strict";
import {createHash,webcrypto} from "node:crypto";
import {
  pythonCanonicalR4a,inspectTriBrainSnapshot,inspectTriBrainText,triBrainReviewHandoff
} from "../src/tribrain-bridge.mjs";

const hash=x=>createHash("sha256").update(x,"utf8").digest("hex");
const CRYPTO={crypto:webcrypto};
const CID1="clm_"+"a".repeat(20),CID2="clm_"+"b".repeat(20);
const RID="rel_"+"c".repeat(20),DID="dec_"+"d".repeat(20);
function claim(id,quote){
  return {
    id,statement:"Source claim: "+quote,recorded_state:"recorded",
    source_observed_at:"2026-11-05T21:00:00.123456+00:00",
    source_observation_age_days:1.0,
    valid_time:{kind:"unspecified",status:"no_valid_time_assertion"},
    warnings:[],citation:{
      source_id:"src_"+"e".repeat(20),source_sha256:"f".repeat(64),
      source_title:"Local architecture note",quote,
      quote_offset:1,line_start:1,line_end:1,references:[]
    },source_attribution_only:true
  };
}
function make(overrides={}){
  const base={
    schema_version:1,consumer_label_not_authentication:"PhiMadaPrime",
    scope:"PhiOS",as_of:"2026-11-05T22:00:00.000000+00:00",
    permissions:{source_read:true,database_write:false,network_access:false,
      tool_execution:false,deployment:false,autonomous_actions:false},
    lanes:{
      WITNESS:[claim(CID1,"The witness note"),claim(CID2,"The other note")],
      WEAVER:[{id:RID,left_claim:CID1,right_claim:CID2,
        relation_proposed:"related",review_status:"pending",method:"manual",
        review_required:true,is_factual_truth:false}],
      STEWARD:[{id:DID,title:"Keep local review",rationale:"The text needs independent checking",
        status:"approved",evidence_claim_ids:[CID1,CID2],
        credential_checked:false,review_attestation_digest:"a".repeat(64),
        execution_authorized:false,factual_truth_verified:false}]
    },
    notice:"Explicitly selected, quote-backed local records; statements are unverified."
  };
  const result={...base,...overrides};
  result.content_sha256=hash(pythonCanonicalR4a(result));
  return result;
}
const rehash=x=>{
  const snapshot=structuredClone(x);delete snapshot.content_sha256;
  snapshot.content_sha256=hash(pythonCanonicalR4a(snapshot));
  return snapshot;
};
test("R38 serializer matches actual Python ensure_ascii=False sorting and float 1.0",()=>{
  const value={z:false,a:1,nested:{emoji:"🤖",source_observation_age_days:1.0}};
  const expected='{"a":1,"nested":{"emoji":"🤖","source_observation_age_days":1.0},"z":false}';
  assert.equal(pythonCanonicalR4a(value),expected);
  assert.equal(hash(expected),"f4c6fa83eca8749ca3e6d43a1e97adb639e48dfc76c115183c31226614ae7ce1");
});
test("R38 validates authentic-format WITNESS/WEAVER/STEWARD export, keeps all authority denied",async()=>{
  const fixture=make();
  const result=await inspectTriBrainText(JSON.stringify(fixture,null,2),CRYPTO);
  assert.equal(result.status,"R4A_DIGEST_CONSISTENT_UNAUTHENTICATED");
  assert.equal(result.valid,true);
  assert.equal(result.digestConsistent,true);
  assert.equal(result.sourceAuthenticated,false);
  assert.equal(result.actualSourceVerified,false);
  assert.equal(result.modelExecutionProven,false);
  assert.deepEqual(result.counts,{WITNESS:2,WEAVER:1,STEWARD:1});
  assert.equal(result.authority,"NONE");
  assert.deepEqual(result.permissions,[]);
  assert.equal(result.actionAllowed,false);
  assert.equal(result.lanes.STEWARD[0].status,"approved");
  assert.equal(result.lanes.STEWARD[0].execution_authorized,false);
  const handoff=triBrainReviewHandoff(result);
  assert.match(handoff,/Authority: NONE/);
  assert.doesNotMatch(handoff,/The witness note/);
});
test("R38 missing/altered digest and malformed JSON fail closed",async()=>{
  const snapshot=make();
  snapshot.lanes.WITNESS[0].statement="TAMPER";
  let result=await inspectTriBrainSnapshot(snapshot,CRYPTO);
  assert.equal(result.valid,false);
  assert.match(result.reason,/SHA-256/);
  assert.equal((await inspectTriBrainText("{bad",CRYPTO)).valid,false);
  assert.equal((await inspectTriBrainText("x".repeat(262145),CRYPTO)).valid,false);
});
test("R38 attacker recomputed digest remains explicitly unauthenticated",async()=>{
  const s=make();
  s.lanes.WITNESS[0].statement="Attacker-replaced attribution";
  const report=await inspectTriBrainSnapshot(rehash(s),CRYPTO);
  assert.equal(report.valid,true);
  assert.equal(report.sourceAuthenticated,false);
  assert.equal(report.actualSourceVerified,false);
});
test("R38 disallows permissions and self-approved actions even with rehashed digest",async()=>{
  const scenarios=[
    s=>s.permissions.tool_execution=true,
    s=>s.permissions.network_access=true,
    s=>s.lanes.STEWARD[0].execution_authorized=true,
    s=>s.lanes.STEWARD[0].factual_truth_verified=true,
    s=>s.lanes.WEAVER[0].is_factual_truth=true,
    s=>s.lanes.WITNESS[0].source_attribution_only=false,
    s=>s.admin_grant="execute",
    s=>s.consumer_label_not_authentication="PhiBots"
  ];
  for(const alter of scenarios){
    const s=make();alter(s);
    const report=await inspectTriBrainSnapshot(rehash(s),CRYPTO);
    assert.equal(report.valid,false,JSON.stringify(scenarios.indexOf(alter)));
    assert.equal(report.actionAllowed,false);
  }
});
test("R38 no cross-lane orphan claims, duplicates or over-limit exports",async()=>{
  const scenarios=[
    s=>s.lanes.WEAVER[0].left_claim="clm_"+"f".repeat(20),
    s=>s.lanes.STEWARD[0].evidence_claim_ids=["clm_"+"f".repeat(20)],
    s=>s.lanes.STEWARD[0].evidence_claim_ids=[],
    s=>s.lanes.WITNESS.push(structuredClone(s.lanes.WITNESS[0])),
    s=>s.lanes.WITNESS.reverse(),
    s=>s.lanes.WITNESS=Array.from({length:21},(_,i)=>claim(
      "clm_"+i.toString(16).padStart(20,"0"),"text")),
    s=>s.lanes.WITNESS[0].citation.source_sha256="not-a-hash",
    s=>s.lanes.WITNESS[0].citation.references.push({
      kind:"external_http",url:"https://evil.example"}),
    s=>s.lanes.WITNESS[0].source_observation_age_days=1.234
  ];
  for(const alter of scenarios){
    const s=make();alter(s);
    assert.equal((await inspectTriBrainSnapshot(rehash(s),CRYPTO)).valid,false);
  }
});
test("R38 refuses arbitrary or forged review-only handoffs",()=>{
  assert.throws(()=>triBrainReviewHandoff({valid:true}),/R38_UNVERIFIED_HANDOFF/);
  assert.throws(()=>triBrainReviewHandoff({
    valid:true,status:"R4A_DIGEST_CONSISTENT_UNAUTHENTICATED",
    sourceAuthenticated:true,authority:"NONE",actionAllowed:false
  }),/R38_UNVERIFIED_HANDOFF/);
});
