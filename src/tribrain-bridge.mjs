/* R38: PhiTriBrain369 Rung 4a -> PhiMadaPrime. Offline, unsigned, no grants.
   Producer: src/phitribrain/operator_bridge.py. */
export const MAX_BYTES=262144;
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).sort().join("|")===keys.slice().sort().join("|");
const short=(x,max)=>typeof x==="string"&&x.length>0&&x.length<=max;
const pattern=(x,re)=>typeof x==="string"&&re.test(x);
const hex=/^[0-9a-f]{64}$/, id=p=>new RegExp("^"+p+"_[0-9a-f]{20}$");
const claimId=id("clm"),relationId=id("rel"),decisionId=id("dec"),sourceId=id("src");
const scope=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const isTime=x=>short(x,48)&&/^\d{4}-\d\d-\d\dT/.test(x)&&
  /(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
const int=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const oneOf=(x,options)=>options.includes(x);
const ordered=(rows,re,max)=>Array.isArray(rows)&&rows.length<=max&&rows.every((r,i)=>
  obj(r)&&pattern(r.id,re)&&(i===0||rows[i-1].id<r.id));
const fail=reason=>({status:"HELD_UNTRUSTED_SNAPSHOT",reason,valid:false,
  digestConsistent:false,sourceAuthenticated:false,actualSourceVerified:false,
  actionAllowed:false,permissions:[],authority:"NONE",modelExecutionProven:false});
const permission=["source_read","database_write","network_access","tool_execution","deployment","autonomous_actions"];
function reference(r){
  if(!obj(r))return false;
  if(r.kind==="github_immutable_commit")return exact(r,["kind","repository","commit","path","url"])&&
    pattern(r.repository,/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)&&
    pattern(r.commit,/^[a-f0-9]{40}$/)&&short(r.path,256)&&short(r.url,1024)&&
    r.url.startsWith("https://github.com/");
  return r.kind==="vault_active_note"&&exact(r,["kind","vault_id","path"])&&
    short(r.vault_id,160)&&short(r.path,256);
}
function claim(c){
  if(!exact(c,["id","statement","recorded_state","source_observed_at",
    "source_observation_age_days","valid_time","warnings","citation","source_attribution_only"])||
    !short(c.statement,600)||!oneOf(c.recorded_state,["recorded","disputed","superseded"])||
    !isTime(c.source_observed_at)||c.source_attribution_only!==true||
    typeof c.source_observation_age_days!=="number"||
    !Number.isFinite(c.source_observation_age_days)||c.source_observation_age_days<0||
    c.source_observation_age_days>1000000||
    Math.abs(c.source_observation_age_days*100-Math.round(c.source_observation_age_days*100))>1e-7||
    !Array.isArray(c.warnings)||c.warnings.length>30||
    !c.warnings.every(w=>short(w,300)))return false;
  const v=c.valid_time, cite=c.citation;
  return exact(v,["status","kind"])&&
    ((v.kind==="unspecified"&&v.status==="no_valid_time_assertion")||
    (v.kind==="asserted_not_verified"&&oneOf(v.status,[
      "before_asserted_interval","after_asserted_interval","within_asserted_interval"])))&&
    exact(cite,["source_id","source_sha256","source_title","quote",
      "quote_offset","line_start","line_end","references"])&&
    pattern(cite.source_id,sourceId)&&pattern(cite.source_sha256,hex)&&
    short(cite.source_title,200)&&short(cite.quote,768)&&
    int(cite.quote_offset,5000000)&&int(cite.line_start,5000000)&&
    cite.line_start>0&&int(cite.line_end,5000000)&&
    cite.line_end>=cite.line_start&&Array.isArray(cite.references)&&
    cite.references.length<=10&&cite.references.every(reference);
}
function relation(r,ids){
  return exact(r,["id","left_claim","right_claim","relation_proposed","review_status",
    "method","review_required","is_factual_truth"])&&
    ids.has(r.left_claim)&&ids.has(r.right_claim)&&r.left_claim!==r.right_claim&&
    oneOf(r.relation_proposed,["supports","contradicts","related"])&&
    oneOf(r.review_status,["pending","accepted","rejected","needs_context"])&&
    short(r.method,160)&&r.review_required===(r.review_status==="pending")&&
    r.is_factual_truth===false;
}
function decision(d,ids){
  return exact(d,["id","title","rationale","status","evidence_claim_ids",
    "credential_checked","review_attestation_digest","execution_authorized","factual_truth_verified"])&&
    short(d.title,200)&&short(d.rationale,600)&&
    oneOf(d.status,["proposed","approved","rejected"])&&
    Array.isArray(d.evidence_claim_ids)&&d.evidence_claim_ids.length>=1&&
    d.evidence_claim_ids.length<=20&&d.evidence_claim_ids.every((x,i)=>
      pattern(x,claimId)&&ids.has(x)&&(i===0||d.evidence_claim_ids[i-1]<x))&&
    typeof d.credential_checked==="boolean"&&
    (d.review_attestation_digest===null||pattern(d.review_attestation_digest,hex))&&
    d.execution_authorized===false&&d.factual_truth_verified===false;
}
/* Python json.dumps(ensure_ascii=False,sort_keys=True,separators=(',',':')).
 * R4a's only float is source_observation_age_days: Python serializes 1.0 as 1.0. */
export function pythonCanonicalR4a(x,key=""){
  if(x===null||typeof x==="string"||typeof x==="boolean")return JSON.stringify(x);
  if(typeof x==="number"){
    if(!Number.isFinite(x))throw Error("NONFINITE");
    return key==="source_observation_age_days"&&Number.isInteger(x)?x.toFixed(1):JSON.stringify(x);
  }
  if(Array.isArray(x))return "["+x.map(v=>pythonCanonicalR4a(v)).join(",")+"]";
  if(obj(x))return "{"+Object.keys(x).sort().map(k=>
    JSON.stringify(k)+":"+pythonCanonicalR4a(x[k],k)).join(",")+"}";
  throw Error("BAD_JSON");
}
async function hash(raw,crypto){
  if(!crypto?.subtle)throw Error("NO_WEB_CRYPTO");
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,"0")).join("");
}
export async function inspectTriBrainSnapshot(s,{crypto=globalThis.crypto}={}){
  try{
    if(!exact(s,["schema_version","consumer_label_not_authentication","scope","as_of",
        "permissions","lanes","notice","content_sha256"])||s.schema_version!==1||
      s.consumer_label_not_authentication!=="PhiMadaPrime"||
      !pattern(s.scope,scope)||!isTime(s.as_of)||!short(s.notice,500)||
      !pattern(s.content_sha256,hex)||!exact(s.permissions,permission)||
      s.permissions.source_read!==true||
      permission.slice(1).some(k=>s.permissions[k]!==false)||
      !exact(s.lanes,["WITNESS","WEAVER","STEWARD"]))
      return fail("Invalid schema, scope or execution-denial boundary.");
    const {WITNESS:w,WEAVER:r,STEWARD:d}=s.lanes;
    if(!ordered(w,claimId,20)||w.length<1||!w.every(claim)||
      !ordered(r,relationId,10)||!ordered(d,decisionId,10))
      return fail("Claim, citation or lane shape invalid.");
    const ids=new Set(w.map(x=>x.id));
    if(!r.every(x=>relation(x,ids))||!d.every(x=>decision(x,ids)))
      return fail("Relation or decision lacks allowlisted evidence or no-authority labels.");
    const {content_sha256:expected,...body}=s;
    const full=pythonCanonicalR4a(s);
    if(new TextEncoder().encode(full).byteLength>MAX_BYTES)
      return fail("Snapshot exceeds export limit.");
    if(await hash(pythonCanonicalR4a(body),crypto)!==expected)
      return fail("Canonical SHA-256 does not match this snapshot.");
    return {status:"R4A_DIGEST_CONSISTENT_UNAUTHENTICATED",valid:true,
      reason:"Unsigned, internally consistent point-in-time export; no authentication of producer, independent source replay, factual truth or authority.",
      digestConsistent:true,sourceAuthenticated:false,actualSourceVerified:false,
      modelExecutionProven:false,scope:s.scope,asOf:s.as_of,digest:expected,
      lanes:s.lanes,counts:{WITNESS:w.length,WEAVER:r.length,STEWARD:d.length},
      authority:"NONE",permissions:[],actionAllowed:false};
  }catch{return fail("Malformed or unsupported local snapshot.");}
}
export async function inspectTriBrainText(raw,opts={}){
  if(typeof raw!=="string"||raw.length===0||
    new TextEncoder().encode(raw).byteLength>MAX_BYTES)
    return fail("Missing or oversized JSON.");
  try{return inspectTriBrainSnapshot(JSON.parse(raw),opts);}
  catch{return fail("Invalid snapshot JSON.");}
}
export function triBrainReviewHandoff(r){
  if(r?.valid!==true||r.status!=="R4A_DIGEST_CONSISTENT_UNAUTHENTICATED"||
    r.sourceAuthenticated!==false||r.authority!=="NONE"||r.actionAllowed!==false)
    throw Error("R38_UNVERIFIED_HANDOFF");
  return ["PHIMADA PRIME R38 / TRIBRAIN 369 / REVIEW ONLY",
    "Scope: "+r.scope,"As-of (exporter claim): "+r.asOf,
    "WITNESS: "+r.counts.WITNESS+" attributed claims",
    "WEAVER: "+r.counts.WEAVER+" proposed relations",
    "STEWARD: "+r.counts.STEWARD+" review-only decisions",
    "Self-consistency SHA256: "+r.digest,
    "Producer authenticated: NO; source bytes independently verified: NO",
    "Cross-linked to R36/R37 proof: NO",
    "Authority: NONE; permissions: []; actionAllowed: false"].join("\n");
}
