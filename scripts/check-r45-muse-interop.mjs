#!/usr/bin/env node
/**
 * R45 × Muse interoperability probe: read-only, local files only.
 *
 * Uses the UNMODIFIED PhiMadaPrime R45 verifier. This CLI never invokes Muse,
 * signs, creates an identity, touches the network or grants permissions.
 */
import {readFile} from "node:fs/promises";
import {musePublicKeyToR45Pins} from "../src/verified-pipeline-muse-interop.mjs";
import {verifySignedGmedProvenance}
  from "../src/verified-pipeline-signed-provenance.mjs";

const required=["--report","--envelope","--public-key","--muse-fingerprint",
  "--issuer-id","--repository"];
function usage(){
  return [
    "Usage: node scripts/check-r45-muse-interop.mjs",
    "  --report <original-gmed-v1.json>",
    "  --envelope <r45-signed-envelope.json>",
    "  --public-key <ed25519:base64url-public-key>",
    "  --muse-fingerprint <sha256:raw-key-fingerprint>",
    "  --issuer-id <exact-envelope-issuer-id>",
    "  --repository <MichaelWave369/repo>",
    "",
    "PUBLIC key only. Never pass a mnemonic, seed, passphrase or private key.",
    "Read-only local verifier; no execution, auth, network or issuer certification."
  ].join("\n");
}
async function main(){
  const args=process.argv.slice(2),flags={};
  if(args.length===1&&args[0]==="--help"){
    console.log(usage());return;
  }
  for(let i=0;i<args.length;i+=2){
    const key=args[i],val=args[i+1];
    if(!required.includes(key)||!val||Object.hasOwn(flags,key))
      throw Error("Missing, repeated or unsupported argument. Run --help.");
    flags[key]=val;
  }
  if(required.some(key=>!flags[key]))
    throw Error("Missing arguments. Run --help.");
  const [receipt,envelope]=await Promise.all([
    readFile(flags["--report"],"utf8"),
    readFile(flags["--envelope"],"utf8")
  ]);
  const adapted=await musePublicKeyToR45Pins({
    publicKey:flags["--public-key"],museFingerprint:flags["--muse-fingerprint"],
    issuerId:flags["--issuer-id"],repository:flags["--repository"]
  });
  const outcome=await verifySignedGmedProvenance(
    receipt,envelope,adapted.pinStoreJson,
    {operatorConfirmedIndependentPin:false}
  );
  console.log(JSON.stringify({
    protocol:"R45_MUSE_PUBLIC_KEY_INTEROP_REVIEW_V1",
    muse_raw_key_fingerprint:adapted.museFingerprint,
    r45_spki_key_id:adapted.r45KeyId,
    status:outcome.status,
    report_bytes_matched:outcome.report_bytes_matched,
    signature_math_valid:outcome.signature_math_valid,
    operator_pin_matched:outcome.operator_pin_matched,
    issuer_identity_authenticated:false,
    original_gmed_producer_authenticated:false,
    merge_authorized:false,deploy_authorized:false,
    permissions:[],
    note:"PUBLIC KEY CONSISTENCY is not issuer authentication. No work or CI replayed."
  },null,2));
  if(!outcome.signature_math_valid)process.exitCode=1;
}
main().catch(err=>{
  // Do not print untrusted file contents or provided public-key material.
  console.error("R45 Muse interop: "+(err instanceof Error?err.message:"invalid input"));
  process.exitCode=1;
});
