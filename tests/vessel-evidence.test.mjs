import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto,createHash,generateKeyPairSync,sign} from "node:crypto";
import {SCENARIOS,SCOPE,DOMAIN,verifyR8Passport,verifyR10Evidence} from "../src/vessel-evidence.mjs";

if(!globalThis.crypto?.subtle) Object.defineProperty(globalThis,"crypto",{value:webcrypto,configurable:true});
const date="2026-11-05T00:00:00.000Z";
const digest=x=>createHash("sha256").update(x).digest("hex");

function episode(s,i) {
  const rawSteps=[
    ...s.targets.map(target=>({tool:"inspect",target})),
    {tool:"decide",decision:s.expected}
  ];
  const steps=rawSteps.map((parsed,j)=>({
    turn:j+1,raw:JSON.stringify(parsed),parsed,
    accepted:true,latencyMs:1,
    reply:parsed.tool==="inspect"
      ?JSON.stringify({kind:"SYNTHETIC_INSPECTION",target:parsed.target,
        data:s.readings[parsed.target],effect:"read_only"})
      :JSON.stringify({kind:"SIMULATED_DECISION",value:parsed.decision,
        result:"Recorded for grading only. No external operation occurred."})
  }));
  return {id:"synthetic-"+i,scenarioId:s.id,protocol:"philearn-r6-gauntlet-v1",
    provenance:"OBSERVED",model:"fixture-model",mode:"bare",at:date,
    steps,outcome:"PASS",decision:s.expected};
}
function fixture() {
  const episodes=SCENARIOS.map(episode);
  const certificate={
    protocol:"philearn-r7-scoped-audit-v1",provenance:"LOCAL_UNTRUSTED",
    scope:SCOPE,id:"synthetic-certificate",issuedAt:date,model:"fixture-model",
    mode:"bare",summary:"Six synthetic protocol traces",support:{},
    scenarioIds:SCENARIOS.map(s=>s.id),evidenceIds:episodes.map(e=>e.id)
  };
  certificate.evidenceSha256=digest(JSON.stringify({
    protocol:certificate.protocol,scope:SCOPE,model:certificate.model,
    mode:certificate.mode,episodes
  }));
  const body={
    format:"philearn.skill-passport.v1",exportedAt:date,
    issuerClaim:{app:"PhiLearn",selfReported:true},
    subject:{model:"fixture-model",mode:"bare"},scope:SCOPE,
    boundary:{authority:"NONE",requestedPermissions:[],usage:"INSPECT_ONLY"},
    certificate,episodes
  };
  const passport={...body,payloadSha256:digest(JSON.stringify(body))};
  const {publicKey,privateKey}=generateKeyPairSync("ed25519");
  const spki=publicKey.export({format:"der",type:"spki"});
  const keyId="sha256:"+digest(spki);
  const signed={
    format:"philearn.signed-skill-passport.v1",algorithm:"Ed25519",
    issuerId:"test.issuer",keyId,signedAt:date,passport
  };
  const msg=[DOMAIN,signed.issuerId,keyId,date,passport.payloadSha256,""].join("\n");
  signed.signature=sign(null,Buffer.from(msg),privateKey).toString("base64");
  const trust={format:"philearn.r10.trust-store.v1",keys:[{
    issuerId:signed.issuerId,keyId,publicKeySpkiBase64:spki.toString("base64"),
    allowedScope:SCOPE,active:true
  }]};
  return {signed,trust};
}
const clone=x=>structuredClone(x);

test("R36 replays all six canonical synthetic scenarios and verifies genuine Ed25519", async()=>{
  const {signed,trust}=fixture();
  assert.equal(await verifyR8Passport(signed.passport),true);
  const result=await verifyR10Evidence(signed,trust);
  assert.equal(result.status,"R10_SIGNATURE_VALID_INSPECTION_ONLY");
  assert.equal(result.signatureValid,true);
  assert.equal(result.sourceReplayConsistent,true);
  assert.equal(result.keyPinned,true);
  assert.equal(result.modelExecutionProven,false);
  assert.equal(result.sourceAuthenticityAttested,false);
  assert.equal(result.authority,"NONE");
  assert.deepEqual(result.permissions,[]);
  assert.equal(result.actionAllowed,false);
  assert.equal(result.reviewApproved,false);
});

test("R36 replay without independent trust remains unpinned",async()=>{
  const {signed}=fixture();
  const result=await verifyR10Evidence(signed);
  assert.equal(result.status,"UNPINNED_SIGNATURE");
  assert.equal(result.sourceReplayConsistent,true);
  assert.equal(result.signatureValid,false);
  assert.equal(result.keyPinned,false);
});

test("R36 rejects altered R8 traces even when an attacker rehashes the envelope",async()=>{
  const {signed,trust}=fixture();
  signed.passport.episodes[0].steps[0].reply="FORGED";
  const body={...signed.passport};delete body.payloadSha256;
  signed.passport.payloadSha256=digest(JSON.stringify(body));
  const result=await verifyR10Evidence(signed,trust);
  assert.equal(result.status,"HELD_INVALID_EVIDENCE");
  assert.equal(result.signatureValid,false);
  assert.equal(result.sourceReplayConsistent,false);
});

test("R36 rejects a perfectly shaped but modified Ed25519 signature",async()=>{
  const {signed,trust}=fixture();
  const buf=Buffer.from(signed.signature,"base64");buf[5]^=1;
  signed.signature=buf.toString("base64");
  const result=await verifyR10Evidence(signed,trust);
  assert.equal(result.status,"SIGNATURE_INVALID");
  assert.equal(result.keyPinned,true);
  assert.equal(result.signatureValid,false);
});

test("R36 rejects trust-on-first-use, mismatched key fingerprints and inactive pins",async()=>{
  const {signed,trust}=fixture();
  const other=fixture().trust;
  assert.equal((await verifyR10Evidence(signed,other)).status,"UNPINNED_SIGNATURE");
  const tampered=clone(trust);tampered.keys[0].keyId="sha256:"+"0".repeat(64);
  assert.equal((await verifyR10Evidence(signed,tampered)).status,"HELD_INVALID_EVIDENCE");
  const inactive=clone(trust);inactive.keys[0].active=false;
  assert.equal((await verifyR10Evidence(signed,inactive)).status,"UNPINNED_SIGNATURE");
  const extra=clone(trust);extra.evidenceSelfApproved=true;
  assert.equal((await verifyR10Evidence(signed,extra)).status,"HELD_INVALID_EVIDENCE");
});

test("R36 never accepts executable boundary, extra claims or unsigned model swapping",async()=>{
  const {signed,trust}=fixture();
  const privileged=clone(signed);
  privileged.passport.boundary.requestedPermissions=["merge"];
  assert.equal((await verifyR10Evidence(privileged,trust)).status,"HELD_INVALID_EVIDENCE");
  const forged=clone(signed);
  forged.aiModelExecutionProven=true;
  assert.equal((await verifyR10Evidence(forged,trust)).status,"HELD_INVALID_EVIDENCE");
  const swapped=clone(signed);
  swapped.passport.subject.model="other";
  assert.equal((await verifyR10Evidence(swapped,trust)).status,"HELD_INVALID_EVIDENCE");
});

test("R36 bounds oversized inputs and refuses invalid schemas",async()=>{
  const {signed,trust}=fixture();
  const inflated=clone(signed);
  inflated.passport.episodes[0].steps[0].raw="x".repeat(400000);
  assert.equal((await verifyR10Evidence(inflated,trust)).status,"HELD_INVALID_EVIDENCE");
  assert.equal((await verifyR10Evidence({},trust)).status,"HELD_INVALID_EVIDENCE");
  assert.equal((await verifyR10Evidence(signed,{...trust,keys:"not array"})).status,"HELD_INVALID_EVIDENCE");
});
