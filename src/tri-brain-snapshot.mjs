// R38: strict local PhiTriBrain369 R4a snapshot parser. No fetch, storage, or actions.
// The producer's SHA-256 is a CONTENT CORRUPTION check, not an authenticity signature.
export const TRI_BRAIN_MAX_FILE_BYTES=262144;
export const TRI_BRAIN_CONSUMER="PhiMadaPrime";
const scope=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const claimId=/^clm_[0-9a-f]{20}$/;
const relationId=/^rel_[0-9a-f]{20}$/;
const decisionId=/^dec_[0-9a-f]{20}$/;
const sourceId=/^src_[0-9a-f]{20}$/;
const shaHex=/^[0-9a-f]{64}$/;
const gitSha=/^[0-9a-f]{40}$/;
const defined=(v)=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const text=(v,max)=>typeof v==="string"&&v.length>0&&v.length<=max;
const exact=(v,keys)=>defined(v)&&Object.keys(v).sort().join("|")===keys.slice().sort().join("|");
const finite=(v)=>typeof v==="number"&&Number.isFinite(v);
const integer=(v)=>Number.isSafeInteger(v);
const isTime=(v)=>text(v,55)&&!Number.isNaN(Date.parse(v))&&/^\d{4}-\d\d-\d\dT/.test(v);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const safeStrings=(arr,maxLength,maxItems)=>Array.isArray(arr)&&arr.length<=maxItems&&
  arr.every(x=>text(x,maxLength));

// PhiTriBrain369 serializes the inner object using Python json.dumps(sort_keys=True,
// ensure_ascii=False, separators=(",",":")). Python preserves .0 on its rounded
// source_observation_age_days float; JSON.parse/JSON.stringify normally drop .0.
function pythonCanonical(value,key=""){
  if(value===null)return "null";
  if(typeof value==="string")return JSON.stringify(value);
  if(typeof value==="boolean")return value?"true":"false";
  if(typeof value==="number"){
    assert(finite(value),"Invalid non-finite numeric field");
    if(key==="source_observation_age_days"&&Number.isInteger(value))return value.toFixed(1);
    return JSON.stringify(value);
  }
  if(Array.isArray(value))return "["+value.map(item=>pythonCanonical(item)).join(",")+"]";
  assert(defined(value),"Unsupported content field");
  return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+pythonCanonical(value[k],k)).join(",")+"}";
}

async function browserSha256(message){
  if(!globalThis.crypto?.subtle)throw new Error(
    "Web Crypto unavailable. Use a secure HTTPS origin for local digest checking."
  );
  const digest=await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(message));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

function validateCitation(c){
  assert(exact(c,["source_id","source_sha256","source_title","quote","quote_offset",
    "line_start","line_end","references"]),"Malformed source citation");
  assert(sourceId.test(c.source_id)&&shaHex.test(c.source_sha256),
    "Source ID or digest is invalid");
  assert(text(c.source_title,200)&&text(c.quote,768),"Source quote or title is too long");
  assert(integer(c.quote_offset)&&c.quote_offset>=0&&
    integer(c.line_start)&&c.line_start>0&&
    integer(c.line_end)&&c.line_end>=c.line_start,"Source citation line/offset is invalid");
  assert(Array.isArray(c.references)&&c.references.length<=10,"Too many source references");
  for(const ref of c.references){
    if(ref?.kind==="github_immutable_commit"){
      assert(exact(ref,["kind","repository","commit","path","url"])&&
        text(ref.repository,160)&&gitSha.test(ref.commit)&&
        text(ref.path,256)&&text(ref.url,1024),
        "Malformed pinned GitHub reference");
      // Render the locator as text, not a clickable untrusted URL.
    }else if(ref?.kind==="vault_active_note"){
      assert(exact(ref,["kind","vault_id","path"])&&
        text(ref.vault_id,128)&&text(ref.path,256),
        "Malformed vault note reference");
    }else throw new Error("Unsupported provenance reference");
  }
}

function validateWitness(w){
  assert(exact(w,["id","statement","recorded_state","source_observed_at",
    "source_observation_age_days","valid_time","warnings","citation","source_attribution_only"]),
    "Malformed WITNESS entry");
  assert(claimId.test(w.id)&&text(w.statement,600),"Invalid WITNESS claim");
  assert(["recorded","disputed","superseded"].includes(w.recorded_state),
    "Unknown claim state");
  assert(isTime(w.source_observed_at)&&finite(w.source_observation_age_days)&&
    w.source_observation_age_days>=0,"Invalid source observation time");
  assert(exact(w.valid_time,["kind","status"])&&
    ["unspecified","asserted_not_verified"].includes(w.valid_time.kind)&&
    ["no_valid_time_assertion","before_asserted_interval",
      "within_asserted_interval","after_asserted_interval"].includes(w.valid_time.status),
    "Malformed validity annotation");
  assert(safeStrings(w.warnings,300,30),"Malformed source warnings");
  assert(w.source_attribution_only===true,"Source attribution truth boundary missing");
  validateCitation(w.citation);
}

function validateRelation(r,known){
  assert(exact(r,["id","left_claim","right_claim","relation_proposed","review_status",
    "method","review_required","is_factual_truth"]),"Malformed WEAVER entry");
  assert(relationId.test(r.id)&&claimId.test(r.left_claim)&&
    claimId.test(r.right_claim)&&r.left_claim!==r.right_claim&&
    known.has(r.left_claim)&&known.has(r.right_claim),
    "WEAVER refers to a claim outside the selected snapshot");
  assert(["supports","contradicts","related"].includes(r.relation_proposed)&&
    ["pending","accepted","rejected","needs_context"].includes(r.review_status)&&
    text(r.method,120)&&r.review_required===(r.review_status==="pending")&&
    r.is_factual_truth===false,"Invalid WEAVER review boundary");
}

function validateSteward(d,known){
  assert(exact(d,["id","title","rationale","status","evidence_claim_ids",
    "credential_checked","review_attestation_digest","execution_authorized",
    "factual_truth_verified"]),"Malformed STEWARD entry");
  assert(decisionId.test(d.id)&&text(d.title,200)&&text(d.rationale,600)&&
    ["proposed","approved","rejected"].includes(d.status),"Invalid STEWARD decision");
  assert(Array.isArray(d.evidence_claim_ids)&&d.evidence_claim_ids.length>=1&&
    d.evidence_claim_ids.length<=20&&
    d.evidence_claim_ids.every(id=>claimId.test(id)&&known.has(id))&&
    new Set(d.evidence_claim_ids).size===d.evidence_claim_ids.length,
    "STEWARD refers to evidence outside the selected snapshot");
  assert(typeof d.credential_checked==="boolean"&&
    (d.review_attestation_digest===null||shaHex.test(d.review_attestation_digest))&&
    d.execution_authorized===false&&d.factual_truth_verified===false,
    "Invalid STEWARD authority boundary");
}

export function validateTriBrainSnapshot(value){
  assert(exact(value,["schema_version","consumer_label_not_authentication","scope",
    "as_of","permissions","lanes","notice","content_sha256"]),
    "Unrecognized PhiTriBrain snapshot envelope");
  assert(value.schema_version===1&&
    value.consumer_label_not_authentication===TRI_BRAIN_CONSUMER&&
    typeof value.scope==="string"&&scope.test(value.scope)&&
    isTime(value.as_of)&&text(value.notice,1000)&&shaHex.test(value.content_sha256),
    "Snapshot version, consumer, scope, timestamp or checksum is invalid");
  assert(exact(value.permissions,["source_read","database_write","network_access",
    "tool_execution","deployment","autonomous_actions"])&&
    value.permissions.source_read===true&&
    value.permissions.database_write===false&&
    value.permissions.network_access===false&&
    value.permissions.tool_execution===false&&
    value.permissions.deployment===false&&
    value.permissions.autonomous_actions===false,
    "Snapshot advertises unsupported privileges");
  assert(exact(value.lanes,["WITNESS","WEAVER","STEWARD"]),
    "Missing or unexpected three-brain lanes");
  const {WITNESS,WEAVER,STEWARD}=value.lanes;
  assert(Array.isArray(WITNESS)&&WITNESS.length>=1&&WITNESS.length<=20&&
    Array.isArray(WEAVER)&&WEAVER.length<=10&&
    Array.isArray(STEWARD)&&STEWARD.length<=10,
    "Snapshot exceeds explicit record limits");
  WITNESS.forEach(validateWitness);
  const ids=new Set(WITNESS.map(x=>x.id));
  assert(ids.size===WITNESS.length,"Duplicate WITNESS claim IDs");
  WEAVER.forEach(x=>validateRelation(x,ids));
  STEWARD.forEach(x=>validateSteward(x,ids));
  assert(new Set(WEAVER.map(x=>x.id)).size===WEAVER.length&&
    new Set(STEWARD.map(x=>x.id)).size===STEWARD.length,
    "Duplicate relation or decision IDs");
  return value;
}

export async function parseTriBrainSnapshot(raw,{digest=browserSha256}={}){
  assert(typeof raw==="string","Snapshot must be a local JSON text file");
  assert(new TextEncoder().encode(raw).length<=TRI_BRAIN_MAX_FILE_BYTES,
    "Snapshot exceeds the 256 KB import limit");
  let value;
  try{value=JSON.parse(raw);}catch{throw new Error("Snapshot is not valid JSON");}
  validateTriBrainSnapshot(value);
  const body={...value};
  delete body.content_sha256;
  const actual=await digest(pythonCanonical(body));
  assert(actual===value.content_sha256,
    "Snapshot content digest mismatch. File may be altered or from an incompatible producer.");
  return value;
}

/** Categorical-only review handoff; source and action authority remain unverified. */
export function triBrainReviewSummary(snapshot){
  validateTriBrainSnapshot(snapshot);
  return [
    "PHIMADA PRIME / PHITRIBRAIN369 / REVIEW ONLY",
    "Scope: "+snapshot.scope,
    "Export timestamp (source-claimed): "+snapshot.as_of,
    "WITNESS: "+snapshot.lanes.WITNESS.length+" attributed claims",
    "WEAVER: "+snapshot.lanes.WEAVER.length+" proposed relationships",
    "STEWARD: "+snapshot.lanes.STEWARD.length+" review-only decisions",
    "Self-consistency digest: "+snapshot.content_sha256,
    "Producer authenticated: NO; original source replay: NO",
    "R36/R37 cryptographic binding: NO",
    "Execution authority: NONE; permissions: NONE"
  ].join("\n");
}
