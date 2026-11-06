import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,generateKeyPairSync,sign,webcrypto} from "node:crypto";
import {PROVENANCE_DOMAIN,verifySignedGmedProvenance}
  from "../src/verified-pipeline-signed-provenance.mjs";

const NOW=Date.parse("2026-11-06T09:18:00.000Z");
const SHA="a".repeat(40),SHA256=s=>createHash("sha256").update(s).digest("hex");
const keys=generateKeyPairSync("ed25519");
const der=keys.publicKey.export({type:"spki",format:"der"});
const keyId="sha256:"+SHA256(der);
const ISSUER="phi-test-issuer";
const cryptoOpts={now:NOW,cryptoApi:webcrypto};
function rawReceipt(){
  return JSON.stringify({
    schema:"gmed-report:v1",state:"GMED",merged:true,sha:SHA,
    counts:{total:1,passed:1,accepted:1,failed:0,pending:0,unknown:0},
    checks:[{name:"CI",kind:"check",status:"completed",
      conclusion:"success",grade:"good",url:null}],
    pullUrl:"https://github.com/MichaelWave369/BTM/pull/51",
    title:"Test PR",number:51,
    observedAt:"2026-11-06T09:15:00Z",
    detail:"Reported merged checks",limits:"Not proof of test execution",
    target:{owner:"MichaelWave369",repo:"BTM",
      fullName:"MichaelWave369/BTM",number:51,
      url:"https://github.com/MichaelWave369/BTM/pull/51"}
  });
}
function bundle(raw=rawReceipt(),ed=keys){
  const report=JSON.parse(raw);
  const fingerprint="sha256:"+SHA256(ed.publicKey.export({type:"spki",format:"der"}));
  const claim={
    format:"phi.gmed.provenance-claim.v1",
    scope:"GMED_V1_REPORT_DIGEST_ONLY",
    repository:report.target.fullName,pr_number:report.number,
    merge_sha:report.sha,report_sha256:SHA256(raw),
    observed_at:report.observedAt,authority:"NONE",permissions:[]
  };
  const signedAt="2026-11-06T09:16:00Z";
  const claim_base64=Buffer.from(JSON.stringify(claim)).toString("base64");
  const message=PROVENANCE_DOMAIN+"\n"+ISSUER+"\n"+
    fingerprint+"\n"+signedAt+"\n"+claim_base64+"\n";
  const signature_base64=sign(null,Buffer.from(message),ed.privateKey).toString("base64");
  const envelope={
    format:"phi.gmed.signed-provenance.v1",
    algorithm:"Ed25519",issuer_id:ISSUER,key_id:fingerprint,
    signed_at:signedAt,claim_base64,signature_base64
  };
  const pinStore={
    format:"phi.gmed.operator-pins.v1",
    keys:[{issuer_id:ISSUER,key_id:fingerprint,
      public_key_spki_base64:ed.publicKey.export({type:"spki",format:"der"}).toString("base64"),
      repository:report.target.fullName,active:true}]
  };
  return {claim,envelope,pinStore,raw,signedRaw:JSON.stringify(envelope),
    pinsRaw:JSON.stringify(pinStore)};
}
const verify=(b,options={})=>verifySignedGmedProvenance(
  b.raw,b.signedRaw,b.pinsRaw,{...cryptoOpts,...options});

test("R45 genuine Ed25519 math and matching local pins never assert authenticated issuer",async()=>{
  const x=await verify(bundle(),{operatorConfirmedIndependentPin:true});
  assert.equal(x.status,"SIGNATURE_VALID_OPERATOR_PIN_DECLARED");
  assert.equal(x.report_bytes_matched,true);
  assert.equal(x.signature_math_valid,true);
  assert.equal(x.operator_pin_matched,true);
  assert.equal(x.independent_pin_confirmed_by_operator,true);
  assert.equal(x.issuer_identity_authenticated,false);
  assert.equal(x.original_gmed_producer_authenticated,false);
  assert.equal(x.github_reobserved_here,false);
  assert.equal(x.required_checks_verified,false);
  assert.equal(x.ci_execution_proven,false);
  assert.equal(x.merge_authorized,false);
  assert.equal(x.deploy_authorized,false);
  assert.deepEqual(x.permissions,[]);
});
test("R45 valid Ed25519 math without external pin declaration is not issuer trust",async()=>{
  const x=await verify(bundle());
  assert.equal(x.status,"SIGNATURE_VALID_UNAUTHENTICATED_ISSUER");
  assert.equal(x.signature_math_valid,true);
  assert.equal(x.independent_pin_confirmed_by_operator,false);
  assert.equal(x.issuer_identity_authenticated,false);
});
test("R45 valid envelope with no operator pin store is UNPINNED",async()=>{
  const b=bundle();b.pinsRaw=null;
  const x=await verify(b);
  assert.equal(x.status,"NO_OPERATOR_KEY_PINS");
  assert.equal(x.report_bytes_matched,true);
  assert.equal(x.signature_math_valid,false);
});
test("R45 unsupported/malicious GMED receipt refuses signature verification",async()=>{
  const b=bundle();
  b.raw=JSON.stringify({...JSON.parse(b.raw),execution_authorized:true});
  const x=await verify(b);
  assert.equal(x.status,"INVALID_GMED_REPORT");
  assert.equal(x.signature_math_valid,false);
});
test("R45 even invisible whitespace modifications change exact receipt SHA",async()=>{
  const b=bundle();
  b.raw+=" ";
  const x=await verify(b);
  assert.equal(x.status,"REPORT_BINDING_MISMATCH");
  assert.equal(x.signature_math_valid,false);
});
test("R45 report repository, SHA, PR number or observation date can't be substituted",async()=>{
  for(const [key,value] of [["repository","MichaelWave369/Other"],
    ["merge_sha","b".repeat(40)],["pr_number",999],
    ["observed_at","2026-11-06T09:15:01Z"]]){
    const b=bundle(),claim={...b.claim,[key]:value};
    b.envelope.claim_base64=Buffer.from(JSON.stringify(claim)).toString("base64");
    b.signedRaw=JSON.stringify(b.envelope);
    const x=await verify(b);
    assert.equal(x.status,"REPORT_BINDING_MISMATCH",key);
  }
});
test("R45 wrong signature contents are refused despite trusted matching pin",async()=>{
  const b=bundle();
  const altered=Buffer.from(b.envelope.signature_base64,"base64");
  altered[0]^=0x42;
  b.envelope.signature_base64=altered.toString("base64");
  b.signedRaw=JSON.stringify(b.envelope);
  const x=await verify(b,{operatorConfirmedIndependentPin:true});
  assert.equal(x.status,"INVALID_SIGNATURE");
  assert.equal(x.operator_pin_matched,true);
  assert.equal(x.signature_math_valid,false);
});
test("R45 alternate key with same self-claimed issuer fails key fingerprint binding",async()=>{
  const b=bundle();
  const rogue=generateKeyPairSync("ed25519");
  b.pinStore.keys[0].public_key_spki_base64=
    rogue.publicKey.export({type:"spki",format:"der"}).toString("base64");
  b.pinsRaw=JSON.stringify(b.pinStore);
  const x=await verify(b);
  assert.equal(x.status,"INVALID_OPERATOR_PIN_STORE");
});
test("R45 wrong or inactive public key pin never verifies",async()=>{
  for(const change of [
    p=>{p.keys[0].active=false;},
    p=>{p.keys[0].issuer_id="stranger";},
    p=>{p.keys[0].repository="MichaelWave369/GMED";}
  ]){
    const b=bundle();change(b.pinStore);b.pinsRaw=JSON.stringify(b.pinStore);
    const x=await verify(b);
    assert.equal(x.status,"NO_MATCHING_ACTIVE_PIN");
    assert.equal(x.signature_math_valid,false);
  }
});
test("R45 duplicate pins and unexpected private authority fields are rejected",async()=>{
  const a=bundle();a.pinStore.keys.push({...a.pinStore.keys[0]});
  a.pinsRaw=JSON.stringify(a.pinStore);
  assert.equal((await verify(a)).status,"INVALID_OPERATOR_PIN_STORE");
  const b=bundle();b.pinStore.keys[0].private_key="DO-NOT-SUPPLY";
  b.pinsRaw=JSON.stringify(b.pinStore);
  assert.equal((await verify(b)).status,"INVALID_OPERATOR_PIN_STORE");
});
test("R45 self-signed arbitrary key never creates a built-in trust root",async()=>{
  const attacker=generateKeyPairSync("ed25519");
  const b=bundle(rawReceipt(),attacker);
  const x=await verify(b,{operatorConfirmedIndependentPin:true});
  assert.equal(x.signature_math_valid,true);
  assert.equal(x.issuer_identity_authenticated,false);
  assert.equal(x.merge_authorized,false);
});
test("R45 missing signature, additional grants or malformed claim fail closed",async()=>{
  for(const mutate of [
    e=>{delete e.signature_base64;},
    e=>{e.algorithm="HS256";},
    e=>{e.authority="MERGE";}
  ]){
    const b=bundle();mutate(b.envelope);b.signedRaw=JSON.stringify(b.envelope);
    assert.equal((await verify(b)).status,"INVALID_SIGNED_ENVELOPE");
  }
  const b=bundle();
  const c={...b.claim,permissions:["repo:write"]};
  b.envelope.claim_base64=Buffer.from(JSON.stringify(c)).toString("base64");
  b.signedRaw=JSON.stringify(b.envelope);
  assert.equal((await verify(b)).status,"INVALID_SIGNED_ENVELOPE");
});
test("R45 wrong signature domain or manipulated signing date fails",async()=>{
  const b=bundle();
  b.envelope.signed_at="2026-11-06T09:17:00Z";
  b.signedRaw=JSON.stringify(b.envelope);
  assert.equal((await verify(b)).status,"INVALID_SIGNATURE");
  const older=bundle();older.envelope.signed_at="2026-10-01T00:00:00Z";
  older.signedRaw=JSON.stringify(older.envelope);
  assert.equal((await verify(older)).status,"REPORT_BINDING_MISMATCH");
});
test("R45 noncanonical base64 is held rather than interpreted as valid",async()=>{
  const b=bundle();b.envelope.signature_base64=b.envelope.signature_base64.slice(0,-2)+"xx";
  b.signedRaw=JSON.stringify(b.envelope);
  const x=await verify(b);
  assert.equal(x.signature_math_valid,false);
});
test("R45 missing Web Crypto refuses signed authority",async()=>{
  const x=await verify(bundle(),{cryptoApi:null});
  assert.equal(x.status,"CRYPTO_UNAVAILABLE");
  assert.equal(x.signature_math_valid,false);
  assert.equal(x.merge_authorized,false);
});
test("R45 no trusted issuer public key ships in the source or frontend",()=>{
  const source=readFileSync(new URL("../src/verified-pipeline-signed-provenance.mjs",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../src/verified-pipeline-signed-provenance.jsx",import.meta.url),"utf8");
  assert.match(source,/NO_OPERATOR_KEY_PINS/);
  assert.match(ui,/NO TRUSTED ISSUERS BUILT IN/);
  assert.match(ui,/No trusted issuer keys ship with this app/);
  assert.doesNotMatch(source,/PRIVATE KEY-----|BEGIN PUBLIC KEY|localStorage|sessionStorage/);
  assert.doesNotMatch(ui,/\bfetch\s*\(|dangerouslySetInnerHTML|WebSocket/);
});
test("R45 mounted in existing GMED receipt desk; receipt changes invalidate result",()=>{
  const s=readFileSync(new URL("../src/verified-pipeline-local-receipts.jsx",import.meta.url),"utf8");
  assert.match(s,/SignedProvenanceGate/);
  assert.match(s,/reportRaw=\{gmed\?\.raw\|\|null\}/);
  const ui=readFileSync(new URL("../src/verified-pipeline-signed-provenance.jsx",import.meta.url),"utf8");
  assert.match(ui,/useEffect\(\(\)=>/);
  assert.match(ui,/\[reportRaw\]/);
  assert.match(ui,/selectedReceipt\.current/);
});
