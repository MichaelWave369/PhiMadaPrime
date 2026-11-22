import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,createPublicKey,verify as nodeVerify,webcrypto}
  from "node:crypto";
import {musePublicKeyToR45Pins}
  from "../src/verified-pipeline-muse-interop.mjs";
import {PROVENANCE_DOMAIN,verifySignedGmedProvenance}
  from "../src/verified-pipeline-signed-provenance.mjs";

const vector=JSON.parse(readFileSync(new URL(
  "./fixtures/r45-muse-python-public-vector.json",import.meta.url),"utf8"));
const now=Date.parse("2026-11-21T18:03:00Z");
const SHA256=x=>createHash("sha256").update(x).digest("hex");
const makePins=(changes={})=>musePublicKeyToR45Pins({
  publicKey:vector.publicKey,museFingerprint:vector.museFingerprint,
  issuerId:vector.issuerId,repository:vector.repository,
  cryptoApi:webcrypto,...changes
});
const verify=(raw,env,pins)=>verifySignedGmedProvenance(
  raw,JSON.stringify(env),pins,{cryptoApi:webcrypto,now});

test("R45 Python fixture is public-only, fixed-shape, synthetic and no secret material",()=>{
  assert.deepEqual(Object.keys(vector).sort(),[
    "envelope","fixture","issuerId","museFingerprint","publicKey",
    "r45KeyId","reportRaw","repository","source","synthetic"
  ].sort());
  assert.equal(vector.fixture,"PHI_R45_PYTHON_ED25519_PUBLIC_VECTOR_V1");
  assert.equal(vector.synthetic,true);
  assert.match(vector.source,/Disposable Python cryptography/);
  assert.match(vector.reportRaw,/PUBLIC SYNTHETIC TEST VECTOR ONLY/);
  assert.deepEqual(Object.keys(vector.envelope).sort(),[
    "format","algorithm","issuer_id","key_id","signed_at",
    "claim_base64","signature_base64"
  ].sort());
  assert.equal(vector.envelope.key_id,vector.r45KeyId);
  assert.notEqual(vector.r45KeyId,vector.museFingerprint);
  assert.doesNotMatch(JSON.stringify(vector),/BEGIN (?:PRIVATE|OPENSSH) KEY|BEGIN RSA|mnemonic_seed|seed_phrase|secret_key/);
});

test("R45 verifies public Python-produced Ed25519 test vector through Node and WebCrypto",async()=>{
  const rawPublic=Buffer.from(vector.publicKey.slice(8),"base64url");
  const spki=Buffer.concat([Buffer.from("302a300506032b6570032100","hex"),rawPublic]);
  assert.equal(rawPublic.length,32);
  assert.equal(spki.length,44);
  assert.equal("sha256:"+SHA256(rawPublic),vector.museFingerprint);
  assert.equal("sha256:"+SHA256(spki),vector.r45KeyId);
  const msg=[
    PROVENANCE_DOMAIN,vector.envelope.issuer_id,vector.envelope.key_id,
    vector.envelope.signed_at,vector.envelope.claim_base64,""
  ].join("\n");
  const signature=Buffer.from(vector.envelope.signature_base64,"base64");
  assert.equal(signature.length,64);
  assert.equal(nodeVerify(null,Buffer.from(msg,"utf8"),
    createPublicKey({key:spki,type:"spki",format:"der"}),signature),true);
  const {pinStoreJson}=await makePins();
  const result=await verify(vector.reportRaw,vector.envelope,pinStoreJson);
  assert.equal(result.status,"SIGNATURE_VALID_UNAUTHENTICATED_ISSUER");
  assert.equal(result.report_bytes_matched,true);
  assert.equal(result.signature_math_valid,true);
  assert.equal(result.operator_pin_matched,true);
  assert.equal(result.repository,vector.repository);
  assert.equal(result.pr_number,23);
  assert.equal(result.issuer_identity_authenticated,false);
  assert.equal(result.original_gmed_producer_authenticated,false);
  assert.equal(result.github_reobserved_here,false);
  assert.equal(result.ci_execution_proven,false);
  assert.equal(result.merge_authorized,false);
  assert.equal(result.deploy_authorized,false);
  assert.deepEqual(result.permissions,[]);
});

test("R45 Python public vector: altered report, key, signature and revision are rejected",async()=>{
  const {pinStoreJson}=await makePins();
  assert.equal((await verify(vector.reportRaw+" ",vector.envelope,pinStoreJson)).status,
    "REPORT_BINDING_MISMATCH");
  const badSig=Buffer.from(vector.envelope.signature_base64,"base64");
  badSig[0]^=1;
  assert.equal((await verify(vector.reportRaw,{
    ...vector.envelope,signature_base64:badSig.toString("base64")
  },pinStoreJson)).status,"INVALID_SIGNATURE");
  const badRevision=JSON.parse(Buffer.from(
    vector.envelope.claim_base64,"base64").toString("utf8"));
  badRevision.merge_sha="b".repeat(40);
  assert.equal((await verify(vector.reportRaw,{
    ...vector.envelope,
    claim_base64:Buffer.from(JSON.stringify(badRevision)).toString("base64")
  },pinStoreJson)).status,"REPORT_BINDING_MISMATCH");
  await assert.rejects(makePins({
    museFingerprint:"sha256:"+"f".repeat(64)
  }),/do not match/);
  const {pinStoreJson:wrongIssuer}=await makePins({
    issuerId:"musehub:someone-else"
  });
  assert.equal((await verify(vector.reportRaw,vector.envelope,wrongIssuer)).status,
    "NO_MATCHING_ACTIVE_PIN");
});

test("R45 Python public vector: authority and permissions cannot be smuggled in",async()=>{
  const {pinStoreJson}=await makePins();
  const claim=JSON.parse(Buffer.from(vector.envelope.claim_base64,"base64").toString("utf8"));
  claim.permissions=["repo:write"];
  const x={...vector.envelope,
    claim_base64:Buffer.from(JSON.stringify(claim)).toString("base64")};
  const result=await verify(vector.reportRaw,x,pinStoreJson);
  assert.equal(result.status,"INVALID_SIGNED_ENVELOPE");
  assert.equal(result.signature_math_valid,false);
  assert.equal(result.merge_authorized,false);
  assert.equal(result.deploy_authorized,false);
});
