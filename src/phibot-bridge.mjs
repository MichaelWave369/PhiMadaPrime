// R35: operator-imported LOCAL PhiBot queue metadata. No localhost fetch or authority.
export const QUEUE_SCHEMA="phibot.queue-crew-export.v1";
const STATES=["queued","leased","completed","exhausted"];
const CAPABILITIES=["repo.steward.discover","repo.steward.inspect"];
const OUTCOMES=[
 "OBSERVED_NO_PROMOTION","STALE_LEASE_RECOVERED","TOOL_DENIED",
 "TOOL_GATED","TOOL_FAILED","EXECUTION_EXCEPTION"
];
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const ID=/^[a-f0-9]{64}$/;
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).sort().join("|")===keys.slice().sort().join("|");
const validISO=x=>typeof x==="string"&&ISO.test(x)&&
 Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const deny=code=>{throw Error("R35_"+code);};

export function validateQueueExport(raw,catalog,nowMs=Date.now()){
 if(!exact(raw,["schema","producer","classification","generatedAt","scope","counts","jobs"])||
    raw.schema!==QUEUE_SCHEMA||raw.producer!=="MichaelWave369/phibot"||
    raw.classification!=="LOCAL_OPERATOR_SELF_REPORT_NOT_ATTESTED")
    deny("SCHEMA_INVALID");
 if(!validISO(raw.generatedAt))deny("TIME_INVALID");
 const generated=Date.parse(raw.generatedAt);
 if(!Number.isFinite(nowMs)||generated>nowMs+300000||nowMs-generated>86400000)
   deny("SNAPSHOT_STALE_OR_FUTURE");
 const s=raw.scope;
 if(!exact(s,["origin","runtimeWorkersVerified","modelRunsVerified",
   "remoteWritesVerified","grantsIssued","completeFleetClaim",
   "operatorDisclosureRequired"])||
   s.origin!=="LOCAL_PERSISTED_READ_ONLY_QUEUE"||
   s.runtimeWorkersVerified!==false||s.modelRunsVerified!==false||
   s.remoteWritesVerified!==false||s.grantsIssued!==false||
   s.completeFleetClaim!==false||s.operatorDisclosureRequired!==true)
   deny("SCOPE_INVALID");
 if(!exact(raw.counts,["total",...STATES])||
   !Object.values(raw.counts).every(v=>Number.isSafeInteger(v)&&v>=0&&v<=100))
   deny("COUNTS_INVALID");
 if(!Array.isArray(raw.jobs)||raw.jobs.length>100||
    raw.counts.total!==raw.jobs.length)deny("BOUNDS_INVALID");
 if(!Array.isArray(catalog))deny("CATALOG_INVALID");
 const known=new Map(catalog.filter(r=>
   r&&Number.isSafeInteger(r.id)&&r.id>0&&r.exampleOnly===false&&
   typeof r.full_name==="string"&&/^MichaelWave369\/[a-zA-Z0-9_.-]{1,100}$/i.test(r.full_name))
   .map(r=>[r.full_name.toLowerCase(),r.full_name]));
 const seen=new Set(),jobs=[];
 for(const j of raw.jobs){
   if(!exact(j,["id","repository","capability","state","attempts","updatedAt","outcome"])||
     typeof j.id!=="string"||!ID.test(j.id)||seen.has(j.id)||
     typeof j.repository!=="string"||
     !/^MichaelWave369\/[A-Za-z0-9_.-]{1,100}$/i.test(j.repository)||
     !CAPABILITIES.includes(j.capability)||!STATES.includes(j.state)||
     !Number.isSafeInteger(j.attempts)||j.attempts<0||j.attempts>2||
     !validISO(j.updatedAt)||Date.parse(j.updatedAt)>generated+300000||
     !(j.outcome===null||OUTCOMES.includes(j.outcome)))
     deny("JOB_INVALID");
   const official=known.get(j.repository.toLowerCase());
   if(!official)deny("REPOSITORY_NOT_IN_PUBLIC_CATALOG");
   seen.add(j.id);
   jobs.push(Object.freeze({
     id:j.id,repository:official,capability:j.capability,
     state:j.state,attempts:j.attempts,updatedAt:j.updatedAt,
     outcome:j.outcome
   }));
 }
 for(const state of STATES){
   if(raw.counts[state]!==jobs.filter(j=>j.state===state).length)
     deny("COUNTS_MISMATCH");
 }
 return Object.freeze({
   generatedAt:raw.generatedAt,classification:raw.classification,
   counts:Object.freeze({...raw.counts}),jobs:Object.freeze(jobs),
   importedLocally:true,verifiedRuntimeWorkers:0,
   grantAuthority:false,independentAttestation:false
 });
}

export function queueReviewText(snapshot){
 if(!snapshot?.importedLocally||snapshot.grantAuthority!==false||
   !Array.isArray(snapshot.jobs))deny("UNTRUSTED_REVIEW");
 return [
  "PHIMADAPRIME R35 / MANUAL PHIBOT QUEUE IMPORT / REVIEW ONLY",
  "Generated (source-claimed): "+snapshot.generatedAt,
  "Classification: LOCAL_OPERATOR_SELF_REPORT_NOT_ATTESTED",
  "Jobs: "+snapshot.counts.total,
  "Queued: "+snapshot.counts.queued+
   " / leased: "+snapshot.counts.leased+
   " / completed reads: "+snapshot.counts.completed+
   " / exhausted: "+snapshot.counts.exhausted,
  "This is a source-claimed local queue file, NOT proof of running models,",
  "verified agent identity, GitHub writes, grants, approvals, CI or deployment.",
  "No task is dispatched and no authorization is conveyed."
 ].join("\n");
}
