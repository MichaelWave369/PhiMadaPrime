import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {parseTriBrainSnapshot,validateTriBrainSnapshot,TRI_BRAIN_MAX_FILE_BYTES}
  from "../src/tri-brain-snapshot.mjs";

const digest=async raw=>createHash("sha256").update(raw,"utf8").digest("hex");
const A="clm_"+"a".repeat(20), B="clm_"+"b".repeat(20);
const REL="rel_"+"c".repeat(20), DEC="dec_"+"d".repeat(20), SRC="src_"+"e".repeat(20);
const HASH="f".repeat(64);
// Golden fixture SHA calculated by PhiTriBrain369 producer's Python canonical_json
// (json.dumps(sort_keys=True,ensure_ascii=False,separators=(",",":"))).
const GOLDEN="b23eb7393212adad2eaff8b06cd46656760b2752ccb1411cf7cd10da3b0768f1";
function witness(id,statement,quote,offset){
  return {
    id,statement,recorded_state:"recorded",
    source_observed_at:"2026-11-05T00:00:00+00:00",
    source_observation_age_days:0.0,
    valid_time:{kind:"unspecified",status:"no_valid_time_assertion"},
    warnings:[],
    citation:{
      source_id:SRC,source_sha256:HASH,source_title:"Architectural note",
      quote,quote_offset:offset,line_start:1,line_end:1,references:[]
    },
    source_attribution_only:true
  };
}
function fixture(){
  return {
    schema_version:1,
    consumer_label_not_authentication:"PhiMadaPrime",
    scope:"PhiOS",as_of:"2026-11-05T00:00:00+00:00",
    permissions:{source_read:true,database_write:false,network_access:false,
      tool_execution:false,deployment:false,autonomous_actions:false},
    lanes:{
      WITNESS:[witness(A,"Evidence is preserved","test quote",5),
        witness(B,"Build observed green","build green",20)],
      WEAVER:[{id:REL,left_claim:A,right_claim:B,relation_proposed:"related",
        review_status:"pending",method:"manual",review_required:true,
        is_factual_truth:false}],
      STEWARD:[{id:DEC,title:"Manual review only",
        rationale:"Inspection precedes decisions",status:"approved",
        evidence_claim_ids:[A],credential_checked:true,
        review_attestation_digest:HASH,execution_authorized:false,
        factual_truth_verified:false}]
    },
    notice:"Unverified source claims; no execution authority.",
    content_sha256:GOLDEN
  };
}
const cloned=(v)=>structuredClone(v);
async function inspect(value){
  return parseTriBrainSnapshot(JSON.stringify(value),{digest});
}
async function expectRejection(change,message){
  const bad=fixture();change(bad);
  await assert.rejects(inspect(bad),message);
}

test("R37 independently accepts the Python producer's canonical digest including 0.0",async()=>{
  const x=await inspect(fixture());
  assert.equal(x.content_sha256,GOLDEN);
  assert.equal(x.lanes.WITNESS.length,2);
  assert.equal(x.lanes.WEAVER.length,1);
  assert.equal(x.lanes.STEWARD.length,1);
  assert.equal(x.permissions.tool_execution,false);
});
test("R37 flags unchanged-shape tampering via the content digest",async()=>{
  await expectRejection(x=>{x.lanes.WITNESS[0].statement="Falsified but plausible";},
    /digest mismatch/);
});
test("R37 fails closed on execution / deployment privilege escalation",async()=>{
  for(const key of ["database_write","network_access","tool_execution",
    "deployment","autonomous_actions"]){
    await expectRejection(x=>{x.permissions[key]=true},/privileges/);
  }
  await expectRejection(x=>{x.lanes.STEWARD[0].execution_authorized=true},
    /authority boundary/);
  await expectRejection(x=>{x.lanes.WEAVER[0].is_factual_truth=true},
    /review boundary/);
});
test("R37 consumer name is NOT an authentication credential",async()=>{
  await expectRejection(x=>{x.consumer_label_not_authentication="PhiBots";},
    /scope|consumer/);
  await expectRejection(x=>{x.scope="../OtherScope";},
    /scope|consumer/);
  await expectRejection(x=>{x.schema_version=2;},
    /version|scope/);
});
test("R37 only accepts explicitly included dependencies",async()=>{
  await expectRejection(x=>{x.lanes.WITNESS.pop();},
    /outside the selected snapshot/);
  await expectRejection(x=>{x.lanes.STEWARD[0].evidence_claim_ids=[B,REL];},
    /outside the selected snapshot/);
  await expectRejection(x=>{x.lanes.STEWARD[0].evidence_claim_ids=[];},
    /outside the selected snapshot/);
});
test("R37 rejects duplicate IDs and malformed quote anchors",async()=>{
  await expectRejection(x=>{x.lanes.WITNESS.push(cloned(x.lanes.WITNESS[0]));},
    /Duplicate WITNESS/);
  await expectRejection(x=>{x.lanes.WITNESS[0].citation.quote_offset=-1;},
    /line\/offset/);
  await expectRejection(x=>{x.lanes.WITNESS[0].citation.source_sha256="bad";},
    /digest/);
  await expectRejection(x=>{x.lanes.WITNESS[0].source_attribution_only=false;},
    /truth boundary/);
});
test("R37 rejects unexpected objects and untrusted provenance types",async()=>{
  await expectRejection(x=>{x.auto_execute=true;},/envelope/);
  await expectRejection(x=>{x.lanes.WITNESS[0].citation.references=[
    {kind:"external_url",url:"javascript:alert(1)"}
  ];},/Unsupported provenance/);
  await expectRejection(x=>{x.lanes.WRITER=[];},/three-brain lanes/);
});
test("R37 enforces bytes before JSON parsing",async()=>{
  const giant="x".repeat(TRI_BRAIN_MAX_FILE_BYTES+1);
  await assert.rejects(
    parseTriBrainSnapshot(giant,{digest}),/256 KB/
  );
  await assert.rejects(
    parseTriBrainSnapshot("{bad json}",{digest}),/not valid JSON/
  );
});
test("R37 refuses unsigned, missing-digest, or malformed external snapshots",async()=>{
  await expectRejection(x=>{delete x.content_sha256;},/envelope/);
  await expectRejection(x=>{x.content_sha256="0".repeat(64);},/digest mismatch/);
  await expectRejection(x=>{x.lanes.WEAVER[0].review_status="automatically_executed";},
    /review boundary/);
});
test("R37 is mounted in existing ThinkTank navigation, not a parallel app",()=>{
  const text=readFileSync(new URL("../src/thinktank.jsx",import.meta.url),"utf8");
  assert.match(text,/TriBrainSnapshotViewer/);
  assert.match(text,/Three-Brain Ledger/);
  assert.match(text,/page==="tribrain"/);
});
test("R37 bridge has no active network or browser persistence implementations",()=>{
  const s=readFileSync(new URL("../src/tri-brain-viewer.jsx",import.meta.url),"utf8");
  assert.doesNotMatch(s,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bWebSocket\b/);
  assert.match(s,/type="file"/);
  assert.match(s,/Clear loaded evidence/);
});
