// R34: public PhiBot example definitions, not installed/runtime agents.
export const SOURCE=Object.freeze({repo:"MichaelWave369/phibot",
 sha:"fda4ac026756742bab07be03695e59caf3f57195"});
export const EXAMPLES=Object.freeze([
 Object.freeze({id:"scoutbot",file:"scout.phibot.json"}),
 Object.freeze({id:"local-scoutbot",file:"local-scout.phibot.json"}),
 Object.freeze({id:"repo-scout",file:"repo-scout.phibot.json"}),
 Object.freeze({id:"patchbot",file:"patch.phibot.json"}),
 Object.freeze({id:"utilitybot",file:"utility.phibot.json"})
]);
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const word=(x,n=160)=>typeof x==="string"&&x.length>0&&x.length<=n&&!/[\x00-\x1f\x7f]/.test(x);
export function manifestUrl(entry){
 if(!EXAMPLES.includes(entry))throw Error("R34_UNLISTED_SOURCE");
 return "https://raw.githubusercontent.com/"+SOURCE.repo+"/"+SOURCE.sha+"/bots/examples/"+entry.file;
}
export function projectManifest(raw,entry){
 if(!EXAMPLES.includes(entry))throw Error("R34_UNLISTED_SOURCE");
 if(!obj(raw)||raw.id!==entry.id||!word(raw.name,80)||!word(raw.role,80)||
   !word(raw.version,40)||!word(raw.description,320))
   throw Error("R34_MANIFEST_IDENTITY");
 if(!obj(raw.model)||!word(raw.model.provider,80)||!word(raw.model.name,100)||
   !obj(raw.memory)||!word(raw.memory.scope,60)||
   !Number.isSafeInteger(raw.memory.maxDepth)||raw.memory.maxDepth<0||raw.memory.maxDepth>64)
   throw Error("R34_MANIFEST_FIELDS");
 if(!Array.isArray(raw.capabilities)||raw.capabilities.length>24||
   raw.capabilities.some(c=>typeof c!=="string"||!/^[a-z][a-z0-9_.:-]{0,79}$/i.test(c))||
   new Set(raw.capabilities).size!==raw.capabilities.length)
   throw Error("R34_CAPABILITIES_INVALID");
 const a=raw.authority;
 if(!obj(a)||typeof a.read!=="boolean"||typeof a.propose!=="boolean"||
    ![true,false,"gated"].includes(a.write)||typeof a.deploy!=="boolean")
   throw Error("R34_AUTHORITY_INVALID");
 return Object.freeze({
  id:raw.id,file:entry.file,name:raw.name,role:raw.role,version:raw.version,
  description:raw.description,provider:raw.model.provider,model:raw.model.name,
  memoryScope:raw.memory.scope,memoryDepth:raw.memory.maxDepth,
  capabilities:Object.freeze([...raw.capabilities]),
  declaredAuthority:Object.freeze({read:a.read,propose:a.propose,write:a.write,deploy:a.deploy}),
  sourceUrl:"https://github.com/"+SOURCE.repo+"/blob/"+SOURCE.sha+"/bots/examples/"+entry.file,
  evidence:"PUBLISHED_MANIFEST_ONLY",running:"NOT_OBSERVED"
 });
}
export async function fetchExample(entry,fetcher=globalThis.fetch){
 if(typeof fetcher!=="function")throw Error("R34_FETCH_UNAVAILABLE");
 const res=await fetcher(manifestUrl(entry),{method:"GET",credentials:"omit",
  redirect:"error",cache:"no-store",headers:{Accept:"application/json"}});
 if(!res?.ok)throw Error("R34_FETCH_FAILED");
 const body=await res.text();
 if(typeof body!=="string"||body.length>10000)throw Error("R34_SIZE_INVALID");
 let raw;
 try{raw=JSON.parse(body);}catch{throw Error("R34_JSON_INVALID");}
 return projectManifest(raw,entry);
}
export async function loadExamples(fetcher=globalThis.fetch){
 const finished=await Promise.allSettled(EXAMPLES.map(e=>fetchExample(e,fetcher)));
 const entries=finished.map((s,i)=>s.status==="fulfilled"?
  {file:EXAMPLES[i].file,ok:true,manifest:s.value}:
  {file:EXAMPLES[i].file,ok:false,error:
   /^R34_/.test(s.reason?.message||"")?s.reason.message:"R34_FETCH_FAILED"});
 return Object.freeze({entries,loaded:entries.filter(e=>e.ok).length,
  unavailable:entries.filter(e=>!e.ok).length,
  runtimeConnected:false,dispatched:0,grantsIssued:0});
}
export function reviewHandoff(m){
 if(!obj(m)||!EXAMPLES.some(e=>e.file===m.file&&e.id===m.id)||
   m.evidence!=="PUBLISHED_MANIFEST_ONLY")throw Error("R34_UNTRUSTED_HANDOFF");
 return [
 "R34 PHIBOT CREW / REVIEW-ONLY EXAMPLE MANIFEST",
 "Repo: "+SOURCE.repo,"Pinned SHA: "+SOURCE.sha,
 "Path: bots/examples/"+m.file,"ID: "+m.id,"Role: "+m.role,
 "Capabilities declared: "+m.capabilities.join(", "),
 "Write authority declared: "+String(m.declaredAuthority.write),
 "Runtime: NOT OBSERVED; no proven agent identity or running process.",
 "This handoff neither dispatches work nor conveys grants, execution proof, CI approval, or merge authority."
 ].join("\n");
}
