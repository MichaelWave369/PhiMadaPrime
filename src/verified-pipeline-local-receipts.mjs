// R42: read-only, local-only cross-source receipt correlation.
// GMED v1 receipts are self-reported unsigned GitHub observations, not proofs.
// PhiTriBrain R4a snapshots are self-checksummed exports, not authenticated records.
import {z} from "zod";
import {validateTriBrainSnapshot} from "./tri-brain-snapshot.mjs";

export const GMED_MAX_BYTES=262144;
const sha=z.string().regex(/^[0-9a-f]{40}$/);
const safe=z.string().min(1).max(500);
const url=z.string().url().refine(v=>v.startsWith("https://github.com/"));
const target=z.strictObject({
  owner:z.string().regex(/^[A-Za-z0-9-]{1,39}$/),
  repo:z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/).refine(v=>v!=="."&&v!==".."),
  fullName:safe,number:z.number().int().min(1).max(1_000_000_000),
  url
});
const row=z.strictObject({
  name:safe,kind:z.enum(["check","status"]),status:safe,
  conclusion:z.string().max(50).nullable(),
  grade:z.enum(["good","bad","pending","unknown"]),
  url:z.string().url().refine(s=>s.startsWith("https://")).nullable()
});
const counts=z.strictObject({
  total:z.number().int().min(0).max(1000),
  passed:z.number().int().min(0).max(1000),
  accepted:z.number().int().min(0).max(1000),
  failed:z.number().int().min(0).max(1000),
  pending:z.number().int().min(0).max(1000),
  unknown:z.number().int().min(0).max(1000)
});
const gmedReceipt=z.strictObject({
  schema:z.literal("gmed-report:v1"),
  state:z.enum(["GMED","NOT_MERGED","FAILED","PENDING","UNVERIFIED"]),
  merged:z.boolean(),sha:sha.nullable(),counts,
  checks:z.array(row).max(1000),pullUrl:url.nullable(),
  title:z.string().max(300),number:z.number().int().min(1).max(1_000_000_000),
  observedAt:z.string().max(55),detail:z.string().max(1000),
  limits:z.string().max(1000),target
});
const GOOD=new Set(["success","neutral","skipped"]);
const BAD=new Set(["failure","timed_out","cancelled","action_required","startup_failure","stale"]);
const WAIT=new Set(["queued","in_progress","pending","requested","waiting"]);
const SHA=/^[0-9a-f]{40}$/;
function score(row){
  if(row.kind==="status"){
    if(row.conclusion!==null)return "invalid";
    return row.status==="success"?"good":row.status==="pending"?"pending":
      ["failure","error"].includes(row.status)?"bad":"unknown";
  }
  if(row.status==="completed"){
    return GOOD.has(row.conclusion)?"good":BAD.has(row.conclusion)?"bad":"unknown";
  }
  return WAIT.has(row.status)?"pending":"unknown";
}
function deriveReceipt(doc){
  const items=doc.checks;
  const tally={total:items.length,passed:0,accepted:0,failed:0,pending:0,unknown:0};
  for(const r of items){
    const rating=score(r);
    if(rating!==r.grade)return null;
    if(rating==="good"){
      tally.accepted++;
      if(r.kind==="status"||r.conclusion==="success")tally.passed++;
    }else if(rating==="bad")tally.failed++;
    else if(rating==="pending")tally.pending++;
    else tally.unknown++;
  }
  for(const key of Object.keys(tally)){
    if(tally[key]!==doc.counts[key])return null;
  }
  const state=!doc.merged?"NOT_MERGED":!doc.sha?"UNVERIFIED":
    tally.failed?"FAILED":tally.pending?"PENDING":tally.unknown?"UNVERIFIED":
    !tally.total||!tally.passed?"UNVERIFIED":"GMED";
  return state===doc.state?state:null;
}

export function inspectGmedLocalReceipt(raw,now=Date.now()){
  if(typeof raw!=="string"||!raw.length||
     new TextEncoder().encode(raw).byteLength>GMED_MAX_BYTES)
    throw Error("GMED receipt must be at most 256 KiB");
  let input;
  try{input=JSON.parse(raw);}catch{throw Error("Malformed GMED JSON");}
  const parsed=gmedReceipt.safeParse(input);
  if(!parsed.success)throw Error("Unsupported or authority-claiming GMED receipt schema");
  const d=parsed.data,t=d.target;
  if(t.fullName!==t.owner+"/"+t.repo||t.url!==
     "https://github.com/"+t.fullName+"/pull/"+t.number||
     d.number!==t.number||(d.pullUrl!==null&&d.pullUrl!==t.url))
    throw Error("GMED PR identity is inconsistent");
  if((d.merged&&d.sha===null&&d.state!=="UNVERIFIED")||
     (!d.merged&&d.state!=="NOT_MERGED")||
     (d.sha!==null&&!SHA.test(d.sha)))
    throw Error("GMED merge commit metadata is invalid");
  const recomputed=deriveReceipt(d);
  if(!recomputed)throw Error("GMED reported state, row grades or counts are inconsistent");
  const observation=Date.parse(d.observedAt);
  if(!Number.isFinite(observation)||!/Z$|[+-]\d\d:\d\d$/.test(d.observedAt)||
     observation>now+300000)
    throw Error("GMED observation timestamp is invalid or future-dated");
  const recent=now-observation<=15*60_000;
  return {
    kind:"LOCAL_GMED_V1_CONSISTENCY_REVIEW",
    reported_state:d.state,reported_sha:d.sha,reported_repository:t.fullName,
    reported_pr:t.number,observed_at:d.observedAt,reported_signals:d.counts.total,
    reported_successes:d.counts.passed,
    state:recent?"UNSIGNED_RECEIPT_SELF_CONSISTENT":"STALE_UNSIGNED_RECEIPT",
    fresh_at_review:recent,
    row_counts_recomputed:true,
    signer_authenticated:false,provider_independently_reobserved:false,
    complete_pagination_independently_verified:false,
    required_checks_verified:false,actual_tests_replayed:false,
    execution_authorized:false,merge_authorized:false,permissions:[],
    warning:"GMED report is an unsigned local file. Matching rows and counts do not establish who produced it, whether GitHub was actually queried, or whether tests ran. A GMED state remains a reported state."
  };
}

export function correlateGmedWithWitness(gmed,snapshot){
  const outcome={
    mode:"UNSIGNED_LOCAL_METADATA_COMPARISON",
    state:"NOT_LINKED",
    matches:0,claim_ids:[],
    producer_authenticated:false,original_source_replayed:false,
    quoted_claims_factually_verified:false,
    release_verified:false,merge_authorized:false,permissions:[],
    warning:"Matching commit strings are only metadata correlations between imported files; both files may be forged. No signed provenance, CI execution proof or cross-system permission is established."
  };
  if(!gmed||!snapshot)return outcome;
  validateTriBrainSnapshot(snapshot);
  if(gmed.kind!=="LOCAL_GMED_V1_CONSISTENCY_REVIEW"||
     !SHA.test(gmed.reported_sha||""))return outcome;
  const ids=[];
  for(const w of snapshot.lanes.WITNESS){
    if(w.citation.references.some(ref=>
      ref.kind==="github_immutable_commit"&&
      ref.repository.toLowerCase()===gmed.reported_repository.toLowerCase()&&
      ref.commit===gmed.reported_sha
    ))ids.push(w.id);
  }
  return {...outcome,state:ids.length?"MATCHING_COMMIT_REFERENCE_TEXT":"NO_MATCHING_COMMIT_REFERENCE",
    matches:ids.length,claim_ids:ids};
}
