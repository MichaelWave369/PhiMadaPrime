// Φ World R2 receipt schema: inspection-friendly hash chains, NOT signatures.
// Anyone who can rewrite all records can recompute these hashes. Verify provenance separately.
export const ARENA_SCHEMA = "phi-world/local-model-r2";
export const MAX_RECEIPT_BYTES = 300_000;
const KEY = /^[a-z][a-z0-9_.:-]{0,79}$/i;
const SHA = /^[0-9a-f]{64}$/;
const ACTIONS = new Set(["work","rest","share","steal","sabotage",
  "escalate","exfiltrate","erase_audit","invalid","upkeep"]);
const DECISIONS = new Set(["ALLOWED","DENIED","SYSTEM"]);
const text = (v,max=160) => typeof v==="string"&&v.length<=max&&
  !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
const exact=(obj,keys)=>obj!==null&&typeof obj==="object"&&
  !Array.isArray(obj)&&Object.keys(obj).length===keys.length&&
  keys.every(k=>Object.hasOwn(obj,k));
const HEADER_KEYS=["schema","source","model","scenario","days","agentCount","createdUtc"];
const RECORD_KEYS=["seq","day","agentId","name","action","targetId",
  "decision","reason","effect","channel"];
const SUMMARY_KEYS=["total","allowed","denied","system","active","credits",
  "energy","agents"];
const ENTRY_KEYS=["prevHash","record","hash"];
const RECEIPT_KEYS=["header","entries","summary","finalHash"];
const AGENT_KEYS=["id","alive","credits","energy"];
export function inspectHeader(h){
  if(!exact(h,HEADER_KEYS)||h.schema!==ARENA_SCHEMA||
    h.source!=="LOCAL_OLLAMA"&&h.source!=="MOCK_FIXTURE"||
    !KEY.test(h.model)||!["commons","scarcity","injection","collision"].includes(h.scenario)||
    !Number.isSafeInteger(h.days)||h.days<1||h.days>3||
    h.agentCount!==10||typeof h.createdUtc!=="string"||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(h.createdUtc)||
    !Number.isFinite(Date.parse(h.createdUtc)))
    throw Error("ARENA_HEADER_INVALID");
  return h;
}
export function inspectRecord(r){
  if(!exact(r,RECORD_KEYS)||!Number.isSafeInteger(r.seq)||r.seq<1||
    !Number.isSafeInteger(r.day)||r.day<1||r.day>3||
    !/^a(0[1-9]|10)$/.test(r.agentId)||!text(r.name,80)||
    !ACTIONS.has(r.action)||!text(r.targetId,3)||!DECISIONS.has(r.decision)||
    !text(r.reason,120)||!text(r.effect,180)||!text(r.channel,48)||
    (r.targetId!==""&&!/^a(0[1-9]|10)$/.test(r.targetId)))
    throw Error("ARENA_RECORD_INVALID");
  return r;
}
export function inspectSummary(s,records){
  if(!exact(s,SUMMARY_KEYS)||!Array.isArray(s.agents)||s.agents.length!==10)
    throw Error("ARENA_SUMMARY_INVALID");
  const ids=new Set();
  for(const a of s.agents){
    if(!exact(a,AGENT_KEYS)||!/^a(0[1-9]|10)$/.test(a.id)||
      ids.has(a.id)||typeof a.alive!=="boolean"||
      !Number.isSafeInteger(a.credits)||a.credits<0||a.credits>10000||
      !Number.isSafeInteger(a.energy)||a.energy<0||a.energy>10000)
      throw Error("ARENA_AGENT_INVALID");
    ids.add(a.id);
  }
  const expected={total:records.length,
    allowed:records.filter(r=>r.decision==="ALLOWED").length,
    denied:records.filter(r=>r.decision==="DENIED").length,
    system:records.filter(r=>r.decision==="SYSTEM").length,
    active:s.agents.filter(a=>a.alive).length,
    credits:s.agents.reduce((n,a)=>n+a.credits,0),
    energy:s.agents.reduce((n,a)=>n+a.energy,0)};
  for(const [key,value] of Object.entries(expected))
    if(s[key]!==value)throw Error("ARENA_SUMMARY_COUNTS_INVALID");
  return s;
}
function recordCanonical(r){
  return {seq:r.seq,day:r.day,agentId:r.agentId,name:r.name,action:r.action,
    targetId:r.targetId,decision:r.decision,reason:r.reason,
    effect:r.effect,channel:r.channel};
}
function headerCanonical(h){
  return {schema:h.schema,source:h.source,model:h.model,scenario:h.scenario,
    days:h.days,agentCount:h.agentCount,createdUtc:h.createdUtc};
}
function summaryCanonical(s){
  return {total:s.total,allowed:s.allowed,denied:s.denied,system:s.system,
    active:s.active,credits:s.credits,energy:s.energy,
    agents:s.agents.map(a=>({id:a.id,alive:a.alive,credits:a.credits,energy:a.energy}))};
}
export async function sha256(value,subtle=globalThis.crypto?.subtle){
  if(!subtle||typeof subtle.digest!=="function")throw Error("ARENA_CRYPTO_UNAVAILABLE");
  const hash=await subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,"0")).join("");
}
export async function createArenaReceipt({header,records,summary},subtle){
  inspectHeader(header);
  if(!Array.isArray(records)||records.length>300)throw Error("ARENA_RECORDS_INVALID");
  records.forEach((r,i)=>{inspectRecord(r);
    if(r.seq!==i+1||r.day>header.days)throw Error("ARENA_SEQUENCE_INVALID");});
  inspectSummary(summary,records);
  let previous=await sha256(JSON.stringify(headerCanonical(header)),subtle);
  const entries=[];
  for(const record of records){
    const hash=await sha256(previous+"\n"+JSON.stringify(recordCanonical(record)),subtle);
    entries.push({prevHash:previous,record:recordCanonical(record),hash});
    previous=hash;
  }
  const finalHash=await sha256(previous+"\n"+JSON.stringify(summaryCanonical(summary)),subtle);
  return {header:headerCanonical(header),entries,summary:summaryCanonical(summary),finalHash};
}
export async function verifyArenaReceipt(receipt,subtle){
  if(typeof receipt==="string"){
    if(receipt.length>MAX_RECEIPT_BYTES)throw Error("ARENA_RECEIPT_TOO_LARGE");
    try{receipt=JSON.parse(receipt);}catch{throw Error("ARENA_RECEIPT_BAD_JSON");}
  }
  if(!exact(receipt,RECEIPT_KEYS))throw Error("ARENA_RECEIPT_INVALID");
  inspectHeader(receipt.header);
  if(!Array.isArray(receipt.entries)||receipt.entries.length>300||
    receipt.entries.some(e=>!exact(e,ENTRY_KEYS)||!SHA.test(e.hash)||!SHA.test(e.prevHash)))
    throw Error("ARENA_ENTRIES_INVALID");
  let previous=await sha256(JSON.stringify(headerCanonical(receipt.header)),subtle);
  const records=[];
  for(const entry of receipt.entries){
    inspectRecord(entry.record);
    const r=entry.record;
    if(r.seq!==records.length+1||r.day>receipt.header.days)
      throw Error("ARENA_SEQUENCE_INVALID");
    if(entry.prevHash!==previous)throw Error("ARENA_CHAIN_BROKEN");
    const expected=await sha256(previous+"\n"+JSON.stringify(recordCanonical(r)),subtle);
    if(entry.hash!==expected)throw Error("ARENA_CHAIN_BROKEN");
    records.push(r);previous=expected;
  }
  inspectSummary(receipt.summary,records);
  const end=await sha256(previous+"\n"+JSON.stringify(summaryCanonical(receipt.summary)),subtle);
  if(receipt.finalHash!==end)throw Error("ARENA_FINAL_HASH_INVALID");
  return {header:receipt.header,summary:receipt.summary,records,verifiedHash:end,
    verdict:"INTEGRITY_CHAIN_VALID__NOT_AUTHENTICATED"};
}
