// R45: domain-separated Ed25519 verifier for a GMED v1 receipt's exact bytes.
// Never signs, generates/stores issuer secrets, executes CI, or grants authority.
// A public-key file alongside a signature is NOT independent issuer identity.
import {z} from "zod";
import {inspectGmedLocalReceipt} from "./verified-pipeline-local-receipts.mjs";

export const SIGNED_PROVENANCE_LIMIT=192*1024;
export const PIN_STORE_LIMIT=16*1024;
export const PROVENANCE_DOMAIN="PHI-GMED-REPORT-PROVENANCE-ED25519-V1";
const HEX40=/^[a-f0-9]{40}$/;
const HEX64=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const REPO=/^MichaelWave369\/[A-Za-z0-9_.-]{1,100}$/i;
const KEY_PREFIX=[0x30,0x2a,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x03,0x21,0x00];
const time=z.string().min(19).max(42).refine(s=>
  /^\d{4}-\d\d-\d\dT/.test(s)&&/(Z|[+-]\d\d:\d\d)$/.test(s)&&
  Number.isFinite(Date.parse(s)),"Invalid timezone-aware timestamp");
const keyId=z.string().regex(/^sha256:[a-f0-9]{64}$/);
const base64=z.string().min(4).max(180000).regex(/^[A-Za-z0-9+/]+={0,2}$/);
const claimSchema=z.strictObject({
  format:z.literal("phi.gmed.provenance-claim.v1"),
  scope:z.literal("GMED_V1_REPORT_DIGEST_ONLY"),
  repository:z.string().regex(REPO),
  pr_number:z.number().int().min(1).max(1_000_000_000),
  merge_sha:z.string().regex(HEX40),
  report_sha256:z.string().regex(HEX64),
  observed_at:time,
  authority:z.literal("NONE"),
  permissions:z.array(z.string()).length(0)
});
const envelopeSchema=z.strictObject({
  format:z.literal("phi.gmed.signed-provenance.v1"),
  algorithm:z.literal("Ed25519"),
  issuer_id:z.string().regex(ID),
  key_id:keyId,
  signed_at:time,
  claim_base64:base64,
  signature_base64:base64
});
const keySchema=z.strictObject({
  issuer_id:z.string().regex(ID),
  key_id:keyId,
  public_key_spki_base64:base64,
  repository:z.string().regex(REPO),
  active:z.boolean()
});
const pinSchema=z.strictObject({
  format:z.literal("phi.gmed.operator-pins.v1"),
  keys:z.array(keySchema).max(20)
});
function bytesOf(s){return new TextEncoder().encode(s);}
function hexOf(bytes){return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");}
function unbase64(s){
  const bytes=Uint8Array.from(atob(s),v=>v.charCodeAt(0));
  // Reject noncanonical base64, including unusual padding encodings.
  let out="";for(const byte of bytes)out+=String.fromCharCode(byte);
  if(btoa(out)!==s)throw Error("Noncanonical base64");
  return bytes;
}
function decodeObject(raw,max,schema,label){
  if(typeof raw!=="string"||raw.length===0||bytesOf(raw).length>max)
    throw Error(label+" file is missing or too large");
  let input;
  try{input=JSON.parse(raw);}catch{throw Error(label+" is not JSON");}
  const parsed=schema.safeParse(input);
  if(!parsed.success)throw Error(label+" has an invalid or unauthorized schema");
  return parsed.data;
}
function result(status,extra={}){
  return {
    format:"PHI_GMED_PROVENANCE_REVIEW_V1",
    status,mode:"LOCAL_ED25519_SIGNATURE_INSPECTION",
    report_bytes_matched:false,signature_math_valid:false,
    operator_pin_matched:false,independent_pin_confirmed_by_operator:false,
    issuer_identity_authenticated:false,original_gmed_producer_authenticated:false,
    github_reobserved_here:false,required_checks_verified:false,
    test_commands_replayed:false,ci_execution_proven:false,
    merge_authorized:false,deploy_authorized:false,permissions:[],
    warning:"A valid signature binds a public key to exact report bytes only. Independently establish the key's real issuer, check current GitHub observations and authorize any operation separately.",
    ...extra
  };
}
export async function verifySignedGmedProvenance(reportRaw,signedRaw,pinsRaw=null,{
  now=Date.now(),operatorConfirmedIndependentPin=false,
  cryptoApi=globalThis.crypto
}={}){
  let report;
  try{report=inspectGmedLocalReceipt(reportRaw,now);}
  catch{return result("INVALID_GMED_REPORT");}
  let signed,claim;
  try{
    signed=decodeObject(signedRaw,SIGNED_PROVENANCE_LIMIT,envelopeSchema,"Signed evidence");
    const encoded=unbase64(signed.claim_base64);
    if(encoded.length>10000)throw Error("Oversized claim");
    claim=decodeObject(new TextDecoder("utf-8",{fatal:true}).decode(encoded),
      10000,claimSchema,"Provenance claim");
    if(unbase64(signed.signature_base64).length!==64)
      throw Error("Ed25519 signature must be 64 bytes");
  }catch{return result("INVALID_SIGNED_ENVELOPE");}
  const basic={issuer_id:signed.issuer_id,key_id:signed.key_id,
    repository:claim.repository,pr_number:claim.pr_number,
    signed_at:signed.signed_at};
  if(!cryptoApi?.subtle)return result("CRYPTO_UNAVAILABLE",basic);
  let reportHash;
  try{reportHash=hexOf(await cryptoApi.subtle.digest("SHA-256",bytesOf(reportRaw)));}
  catch{return result("CRYPTO_UNAVAILABLE",basic);}
  if(claim.report_sha256!==reportHash||
     claim.repository!==report.reported_repository||
     claim.pr_number!==report.reported_pr||
     claim.merge_sha!==report.reported_sha||
     claim.observed_at!==report.observed_at||
     Date.parse(signed.signed_at)>now+5*60_000||
     Date.parse(signed.signed_at)<Date.parse(claim.observed_at)-5*60_000)
    return result("REPORT_BINDING_MISMATCH",basic);
  const matched={...basic,report_bytes_matched:true,report_sha256:reportHash};
  if(pinsRaw===null||pinsRaw===undefined)
    return result("NO_OPERATOR_KEY_PINS",matched);
  let pins;
  try{
    pins=decodeObject(pinsRaw,PIN_STORE_LIMIT,pinSchema,"Operator pin store");
    const found=new Set();
    for(const pin of pins.keys){
      const fp=pin.issuer_id+"\0"+pin.key_id;
      if(found.has(fp))throw Error("Duplicate key identity");
      found.add(fp);
      const der=unbase64(pin.public_key_spki_base64);
      if(der.length!==44||KEY_PREFIX.some((v,i)=>der[i]!==v)||
        "sha256:"+hexOf(await cryptoApi.subtle.digest("SHA-256",der))!==pin.key_id)
        throw Error("Invalid key material or key fingerprint");
    }
  }catch{return result("INVALID_OPERATOR_PIN_STORE",matched);}
  const key=pins.keys.filter(p=>p.issuer_id===signed.issuer_id&&
    p.key_id===signed.key_id&&p.repository===claim.repository&&p.active===true);
  if(key.length!==1)return result("NO_MATCHING_ACTIVE_PIN",matched);
  const pinned={...matched,operator_pin_matched:true,
    independent_pin_confirmed_by_operator:operatorConfirmedIndependentPin===true};
  let valid=false;
  try{
    const spki=unbase64(key[0].public_key_spki_base64);
    const imported=await cryptoApi.subtle.importKey("spki",spki,
      {name:"Ed25519"},false,["verify"]);
    const message=bytesOf(PROVENANCE_DOMAIN+"\n"+signed.issuer_id+"\n"+
      signed.key_id+"\n"+signed.signed_at+"\n"+signed.claim_base64+"\n");
    valid=await cryptoApi.subtle.verify("Ed25519",imported,
      unbase64(signed.signature_base64),message);
  }catch{return result("CRYPTO_UNAVAILABLE_OR_INVALID_KEY",pinned);}
  if(!valid)return result("INVALID_SIGNATURE",pinned);
  return result(operatorConfirmedIndependentPin===true?
    "SIGNATURE_VALID_OPERATOR_PIN_DECLARED":
    "SIGNATURE_VALID_UNAUTHENTICATED_ISSUER",{
    ...pinned,signature_math_valid:true
  });
}
