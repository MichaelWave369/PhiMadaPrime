import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateTriBrainSnapshot} from "../src/tri-brain-snapshot.mjs";
import {
  GMED_MAX_BYTES,inspectGmedLocalReceipt,correlateGmedWithWitness
} from "../src/verified-pipeline-local-receipts.mjs";

const NOW=Date.parse("2026-11-05T22:00:00.000Z");
const SHA="a".repeat(40);
const sourceID="src_"+"c".repeat(24),claimID="clm_"+"d".repeat(20);
function receipt(){
  return {
    schema:"gmed-report:v1",state:"GMED",merged:true,sha:SHA,
    counts:{total:1,passed:1,accepted:1,failed:0,pending:0,unknown:0},
    checks:[{name:"CI",kind:"check",status:"completed",
      conclusion:"success",grade:"good",url:null}],
    pullUrl:"https://github.com/MichaelWave369/BTM/pull/51",
    title:"Review gates",number:51,observedAt:"2026-11-05T21:59:00.000Z",
    detail:"Merged; public checks reported success",
    limits:"API observation, not independent execution",
    target:{owner:"MichaelWave369",repo:"BTM",fullName:"MichaelWave369/BTM",
      number:51,url:"https://github.com/MichaelWave369/BTM/pull/51"}
  };
}
const inspect=(value,now=NOW)=>inspectGmedLocalReceipt(JSON.stringify(value),now);
function witness(commit=SHA,repository="MichaelWave369/BTM"){
  return {
    schema_version:1,consumer_label_not_authentication:"PhiMadaPrime",
    scope:"BTM",as_of:"2026-11-05T21:58:00+00:00",
    permissions:{source_read:true,database_write:false,network_access:false,
      tool_execution:false,deployment:false,autonomous_actions:false},
    lanes:{
      WITNESS:[{
        id:claimID,statement:"A local claim",recorded_state:"recorded",
        source_observed_at:"2026-11-05T21:57:00+00:00",
        source_observation_age_days:0.0,
        valid_time:{kind:"unspecified",status:"no_valid_time_assertion"},
        warnings:[],
        citation:{source_id:sourceID,source_sha256:"f".repeat(64),
          source_title:"Some text",quote:"A quote from the stored text.",
          quote_offset:5,line_start:1,line_end:1,
          references:[{kind:"github_immutable_commit",repository,
            commit,path:"docs/notes.md",
            url:"https://github.com/MichaelWave369/BTM/blob/"+commit+"/docs/notes.md#L1"}]
        },source_attribution_only:true
      }],
      WEAVER:[],STEWARD:[]
    },
    notice:"Only self-consistent, untrusted local records",
    content_sha256:"e".repeat(64)
  };
}
test("R42 GMED receipt row recomputation is explicitly not proof of GitHub activity",()=>{
  const x=inspect(receipt());
  assert.equal(x.state,"UNSIGNED_RECEIPT_SELF_CONSISTENT");
  assert.equal(x.reported_state,"GMED");
  assert.equal(x.reported_sha,SHA);
  assert.equal(x.row_counts_recomputed,true);
  assert.equal(x.signer_authenticated,false);
  assert.equal(x.provider_independently_reobserved,false);
  assert.equal(x.complete_pagination_independently_verified,false);
  assert.equal(x.required_checks_verified,false);
  assert.equal(x.actual_tests_replayed,false);
  assert.equal(x.merge_authorized,false);
  assert.deepEqual(x.permissions,[]);
});
test("R42 refuses fake GMED states and unknown claim-of-authority fields",()=>{
  const x=receipt();x.state="VERIFIED_ALL";
  assert.throws(()=>inspect(x),/schema/);
  x.state="GMED";x.authorization="MERGE_ALLOWED";
  assert.throws(()=>inspect(x),/schema/);
});
test("R42 an altered verdict or counts does not pass",()=>{
  const a=receipt();a.state="FAILED";
  assert.throws(()=>inspect(a),/inconsistent/);
  const b=receipt();b.counts.passed=0;
  assert.throws(()=>inspect(b),/inconsistent/);
  const c=receipt();c.checks[0].grade="bad";
  assert.throws(()=>inspect(c),/inconsistent/);
});
test("R42 a fabricated extra row cannot be hidden by the reported total",()=>{
  const a=receipt();
  a.checks.push({name:"Hidden failure",kind:"check",
    status:"completed",conclusion:"failure",grade:"bad",url:null});
  assert.throws(()=>inspect(a),/inconsistent/);
});
test("R42 missing or malformed merge identity cannot become GMED",()=>{
  const a=receipt();a.sha=null;
  assert.throws(()=>inspect(a),/inconsistent/);
  const b=receipt();b.merged=false;
  assert.throws(()=>inspect(b),/invalid|inconsistent/);
});
test("R42 target PR URL, number and case-consistent path are bound",()=>{
  const a=receipt();a.target.repo="Other";
  assert.throws(()=>inspect(a),/identity/);
  const b=receipt();b.target.number=99;
  assert.throws(()=>inspect(b),/identity/);
  const c=receipt();c.pullUrl="https://github.com/MichaelWave369/BTM/pull/77";
  assert.throws(()=>inspect(c),/identity/);
});
test("R42 failed and pending receipts can be consistent but never green",()=>{
  const failure=receipt();
  failure.state="FAILED";failure.checks[0].conclusion="failure";
  failure.checks[0].grade="bad";
  failure.counts={total:1,passed:0,accepted:0,failed:1,pending:0,unknown:0};
  assert.equal(inspect(failure).reported_state,"FAILED");
  const pending=receipt();
  pending.state="PENDING";pending.checks[0].status="in_progress";
  pending.checks[0].conclusion=null;
  pending.checks[0].grade="pending";
  pending.counts={total:1,passed:0,accepted:0,failed:0,pending:1,unknown:0};
  assert.equal(inspect(pending).reported_state,"PENDING");
});
test("R42 neutral/skipped-only receipts never report GMED",()=>{
  const a=receipt();
  a.checks[0].conclusion="neutral";
  a.counts={total:1,passed:0,accepted:1,failed:0,pending:0,unknown:0};
  a.state="UNVERIFIED";
  assert.equal(inspect(a).reported_state,"UNVERIFIED");
  a.state="GMED";
  assert.throws(()=>inspect(a),/inconsistent/);
});
test("R42 old receipt preserves consistent rows but is labeled stale",()=>{
  const x=receipt();x.observedAt="2026-11-01T21:59:00Z";
  const r=inspect(x);
  assert.equal(r.state,"STALE_UNSIGNED_RECEIPT");
  assert.equal(r.fresh_at_review,false);
  assert.equal(r.signer_authenticated,false);
});
test("R42 future or unzoned timestamps are refused",()=>{
  const a=receipt();a.observedAt="2026-12-01T00:00:00Z";
  assert.throws(()=>inspect(a),/timestamp/);
  const b=receipt();b.observedAt="2026-11-05T21:59:00";
  assert.throws(()=>inspect(b),/timestamp/);
});
test("R42 malformed JSON, missing keys, oversize and fabricated fixture rejected",()=>{
  assert.throws(()=>inspectGmedLocalReceipt("{hello}",NOW),/JSON/);
  assert.throws(()=>inspectGmedLocalReceipt("a".repeat(GMED_MAX_BYTES+1),NOW),/256 KiB/);
  const a=receipt();delete a.target;
  assert.throws(()=>inspect(a),/schema/);
  assert.throws(()=>inspect({kind:"PHI_SYNTHETIC_CI_FIXTURE_V1"}),/schema/);
});
test("R42 24-char source ID matches actual PhiTriBrain BrainStore ingest contract",()=>{
  const x=witness();
  assert.doesNotThrow(()=>validateTriBrainSnapshot(x));
  const y=witness();y.lanes.WITNESS[0].citation.source_id="src_"+"c".repeat(20);
  assert.throws(()=>validateTriBrainSnapshot(y),/Source ID/);
});
test("R42 source commit match is metadata only, not authenticity",()=>{
  const g=inspect(receipt()),w=witness();
  const x=correlateGmedWithWitness(g,w);
  assert.equal(x.state,"MATCHING_COMMIT_REFERENCE_TEXT");
  assert.deepEqual(x.claim_ids,[claimID]);
  assert.equal(x.matches,1);
  assert.equal(x.producer_authenticated,false);
  assert.equal(x.original_source_replayed,false);
  assert.equal(x.quoted_claims_factually_verified,false);
  assert.equal(x.release_verified,false);
  assert.equal(x.merge_authorized,false);
  assert.deepEqual(x.permissions,[]);
});
test("R42 mismatched SHA or repository does not link",()=>{
  const g=inspect(receipt());
  assert.equal(correlateGmedWithWitness(g,witness("b".repeat(40))).state,
    "NO_MATCHING_COMMIT_REFERENCE");
  assert.equal(correlateGmedWithWitness(g,witness(SHA,"Other/BTM")).matches,0);
});
test("R42 no WITNESS or no GMED remains unlinked",()=>{
  assert.equal(correlateGmedWithWitness(null,witness()).state,"NOT_LINKED");
  assert.equal(correlateGmedWithWitness(inspect(receipt()),null).matches,0);
});
test("R42 tampered WITNESS provenance or execution permission refused",()=>{
  const g=inspect(receipt()),bad=witness();
  bad.permissions.tool_execution=true;
  assert.throws(()=>correlateGmedWithWitness(g,bad),/privileges/);
});
test("R42 never treats unsigned linkage as independently verified",()=>{
  const g=inspect(receipt()),w=witness();
  const x=correlateGmedWithWitness(g,w);
  assert.equal(x.mode,"UNSIGNED_LOCAL_METADATA_COMPARISON");
  assert.match(x.warning,/both files may be forged/);
  assert.equal(x.producer_authenticated,false);
});
test("R42 local desk reuses the existing strict PhiTriBrain checksum parser",()=>{
  const s=readFileSync(new URL("../src/verified-pipeline-local-receipts.jsx",import.meta.url),"utf8");
  assert.match(s,/parseTriBrainSnapshot\(await file\.text\(\)\)/);
  assert.match(s,/inspectGmedLocalReceipt\(await file\.text\(\)\)/);
  assert.match(s,/Clear both imports/);
  assert.doesNotMatch(s,/dangerouslySetInnerHTML|eval\s*\(|\bfetch\s*\(|localStorage|sessionStorage/);
});
test("R42 contains receipt bridge beneath existing live and synthetic panels",()=>{
  const shell=readFileSync(new URL("../src/verified-pipeline.jsx",import.meta.url),"utf8");
  for(const part of ["LocalReceiptBridge","PublicCiEvidenceBridge","SyntheticGateLab"]){
    assert.match(shell,new RegExp(part));
  }
  const thinktank=readFileSync(new URL("../src/thinktank.jsx",import.meta.url),"utf8");
  for(const room of ["Mission Router","Evidence & Trust","Council Provenance","Three-Brain Ledger"]){
    assert.match(thinktank,new RegExp(room));
  }
});
