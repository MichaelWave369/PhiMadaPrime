import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,generateKeyPairSync,sign,webcrypto} from "node:crypto";
import {decodeMuseEd25519PublicKey,musePublicKeyToR45Pins}
  from "../src/verified-pipeline-muse-interop.mjs";
import {PROVENANCE_DOMAIN,verifySignedGmedProvenance}
  from "../src/verified-pipeline-signed-provenance.mjs";

const sha256=x=>createHash("sha256").update(x).digest("hex");
const now=Date.parse("2026-11-21T21:00:00Z");
const keys=generateKeyPairSync("ed25519"); // disposable, NEVER a Muse identity
const spki=keys.publicKey.export({type:"spki",format:"der"});
const raw=spki.subarray(12);
const b64url=raw.toString("base64url");
const museFp="sha256:"+sha256(raw);
const r45Fp="sha256:"+sha256(spki);
const issuerId="musehub:test-human";
const repository="MichaelWave369/BTM";
const base={publicKey:"ed25519:"+b64url,museFingerprint:museFp,
  issuerId,repository,cryptoApi:webcrypto};
const adapt=override=>musePublicKeyToR45Pins({...base,...override});

function report(){
  return JSON.stringify({
    schema:"gmed-report:v1",state:"GMED",merged:true,
    sha:"a".repeat(40),
    counts:{total:1,passed:1,accepted:1,failed:0,pending:0,unknown:0},
    checks:[{name:"CI",kind:"check",status:"completed",conclusion:"success",
      grade:"good",url:null}],
    pullUrl:"https://github.com/MichaelWave369/BTM/pull/51",title:"Synthetic fixture",
    number:51,observedAt:"2026-11-21T20:55:00Z",
    detail:"SYNTHETIC, not verified CI",limits:"No source checks executed",
    target:{owner:"MichaelWave369",repo:"BTM",
      fullName:"MichaelWave369/BTM",number:51,
      url:"https://github.com/MichaelWave369/BTM/pull/51"}
  });
}
function signedFixture(receipt,key=keys){
  const receiptParsed=JSON.parse(receipt);
  const claim={
    format:"phi.gmed.provenance-claim.v1",
    scope:"GMED_V1_REPORT_DIGEST_ONLY",repository,
    pr_number:receiptParsed.number,
    merge_sha:receiptParsed.sha,
    report_sha256:sha256(Buffer.from(receipt,"utf8")),
    observed_at:receiptParsed.observedAt,
    authority:"NONE",permissions:[]
  };
  const claim_base64=Buffer.from(JSON.stringify(claim),"utf8").toString("base64");
  const signed_at="2026-11-21T20:56:00Z";
  const message=PROVENANCE_DOMAIN+"\n"+issuerId+"\n"+r45Fp+"\n"+
    signed_at+"\n"+claim_base64+"\n";
  return {format:"phi.gmed.signed-provenance.v1",algorithm:"Ed25519",
    issuer_id:issuerId,key_id:r45Fp,signed_at,claim_base64,
    signature_base64:sign(null,Buffer.from(message,"utf8"),key.privateKey)
      .toString("base64")};
}

test("R45 Muse adapter: canonical raw Ed25519 public key maps to standard SPKI",async()=>{
  assert.deepEqual(decodeMuseEd25519PublicKey(b64url),raw);
  assert.deepEqual(decodeMuseEd25519PublicKey("ed25519:"+b64url),raw);
  const x=await adapt();
  assert.equal(x.museFingerprint,museFp);
  assert.equal(x.r45KeyId,r45Fp);
  assert.notEqual(x.museFingerprint,x.r45KeyId);
  assert.equal(x.pinStore.format,"phi.gmed.operator-pins.v1");
  const pin=x.pinStore.keys[0];
  assert.equal(pin.key_id,r45Fp);
  assert.equal(pin.issuer_id,issuerId);
  assert.equal(pin.repository,repository);
  assert.equal(pin.active,true);
  assert.deepEqual(Buffer.from(pin.public_key_spki_base64,"base64"),spki);
  assert.equal(x.issuerIdentityAuthenticated,false);
  assert.equal(x.authorizationGranted,false);
});

test("R45 Muse adapter refuses wrong fingerprint, malformed public keys and private material",async()=>{
  await assert.rejects(adapt({museFingerprint:"sha256:"+"a".repeat(64)}),/do not match/);
  await assert.rejects(adapt({museFingerprint:"sha256:"+museFp.slice(7).toUpperCase()}),/fingerprint/);
  for(const invalid of [
    "-----BEGIN PRIVATE KEY-----", "abandon ".repeat(24), "ed25519:",
    b64url+"=", b64url.slice(0,-1), "ed25519:"+b64url+" ",
    "ed25519:"+raw.toString("hex")
  ]) {
    if(invalid.endsWith(" ") && invalid.startsWith("ed25519:")){
      // surrounding whitespace is tolerated as a copy/paste convenience
      assert.deepEqual(decodeMuseEd25519PublicKey(invalid),raw);
    } else {
      assert.throws(()=>decodeMuseEd25519PublicKey(invalid));
    }
  }
  assert.throws(()=>decodeMuseEd25519PublicKey("ed25519:"+b64url.slice(0,-1)+"B"));
});

test("R45 Muse adapter only creates correctly scoped operator pins",async()=>{
  await assert.rejects(adapt({issuerId:""}),/issuer/);
  await assert.rejects(adapt({issuerId:"evil\nissuer"}),/issuer/);
  await assert.rejects(adapt({repository:"OtherOwner/BTM"}),/repository/);
  await assert.rejects(adapt({repository:"MichaelWave369/.."}),/repository/);
  await assert.rejects(adapt({cryptoApi:null}),/Crypto/);
});

test("R45 accepts a synthetic R45-format signature using Muse-style public key",async()=>{
  const receipt=report(), envelope=signedFixture(receipt);
  const {pinStoreJson}=await adapt();
  const result=await verifySignedGmedProvenance(
    receipt,JSON.stringify(envelope),pinStoreJson,
    {cryptoApi:webcrypto,now});
  assert.equal(result.status,"SIGNATURE_VALID_UNAUTHENTICATED_ISSUER");
  assert.equal(result.report_bytes_matched,true);
  assert.equal(result.signature_math_valid,true);
  assert.equal(result.operator_pin_matched,true);
  assert.equal(result.issuer_identity_authenticated,false);
  assert.equal(result.original_gmed_producer_authenticated,false);
  assert.equal(result.ci_execution_proven,false);
  assert.equal(result.merge_authorized,false);
  assert.equal(result.deploy_authorized,false);
  assert.deepEqual(result.permissions,[]);
});

test("R45 Muse boundary: modified receipt, substituted signer and permission forgery are rejected",async()=>{
  const receipt=report(), {pinStoreJson}=await adapt(), envelope=signedFixture(receipt);
  const verify=(raw,env,pins=pinStoreJson)=>verifySignedGmedProvenance(
    raw,JSON.stringify(env),pins,{cryptoApi:webcrypto,now});
  assert.equal((await verify(receipt+" ",envelope)).status,"REPORT_BINDING_MISMATCH");
  const forgedKey=generateKeyPairSync("ed25519");
  const substituted=signedFixture(receipt,forgedKey);
  assert.equal((await verify(receipt,substituted)).status,"INVALID_SIGNATURE");
  const evilClaim=JSON.parse(Buffer.from(envelope.claim_base64,"base64").toString("utf8"));
  evilClaim.permissions=["repo:write"];
  const evil={...envelope,claim_base64:Buffer.from(JSON.stringify(evilClaim)).toString("base64")};
  assert.equal((await verify(receipt,evil)).status,"INVALID_SIGNED_ENVELOPE");
  const wrongRevision=JSON.parse(Buffer.from(envelope.claim_base64,"base64").toString("utf8"));
  wrongRevision.merge_sha="b".repeat(40);
  const changed={...envelope,claim_base64:Buffer.from(JSON.stringify(wrongRevision)).toString("base64")};
  assert.equal((await verify(receipt,changed)).status,"REPORT_BINDING_MISMATCH");
  const {pinStoreJson:otherPins}=await adapt({
    issuerId:"musehub:another",repository:"MichaelWave369/BTM"});
  assert.equal((await verify(receipt,envelope,otherPins)).status,"NO_MATCHING_ACTIVE_PIN");
});

test("R45 Muse UI is opt-in, browser-local and never signs or acquires private material",()=>{
  const src=readFileSync(new URL("../src/verified-pipeline-muse-interop.jsx",import.meta.url),"utf8");
  const r45=readFileSync(new URL("../src/verified-pipeline-signed-provenance.jsx",import.meta.url),"utf8");
  assert.match(src,/Muse public-key adapter/);
  assert.match(src,/musePublicKeyToR45Pins/);
  assert.match(r45,/MuseR45PinHelper/);
  assert.doesNotMatch(src,/\bfetch\s*\(|localStorage|sessionStorage|sign\s*\(|privateKey|keygen\s*\(/);
});
