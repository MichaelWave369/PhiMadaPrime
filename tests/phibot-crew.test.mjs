import test from "node:test";
import assert from "node:assert/strict";
import {SOURCE,EXAMPLES,manifestUrl,projectManifest,fetchExample,loadExamples,reviewHandoff}
 from "../src/phibot-crew.mjs";
function fixture(e){return {id:e.id,name:"Example "+e.id,role:"test_scout",
 description:"Read-only manifest test.",version:"0.1.0",
 model:{provider:"dry-run",name:"deterministic"},memory:{scope:"task",maxDepth:2},
 capabilities:["repo.read"],authority:{read:true,propose:true,
 write:e.id==="patchbot"?"gated":false,deploy:false}};}
function mock(transform=x=>x){
 const calls=[];
 const get=async(url,options)=>{calls.push({url,options});
  const entry=EXAMPLES.find(e=>manifestUrl(e)===url);
  return entry?{ok:true,text:async()=>JSON.stringify(transform(fixture(entry),entry))}:
   {ok:false,text:async()=>""};
 };
 get.calls=calls;return get;
}
test("R34 only allows five immutable pinned URLs",()=>{
 assert.match(SOURCE.sha,/^[a-f0-9]{40}$/);
 assert.equal(EXAMPLES.length,5);
 assert.equal(new Set(EXAMPLES.map(x=>x.file)).size,5);
 for(const entry of EXAMPLES)
  assert.match(manifestUrl(entry),/^https:\/\/raw\.githubusercontent\.com\/MichaelWave369\/phibot\/[a-f0-9]{40}\/bots\/examples\/[a-z-]+\.phibot\.json$/);
 assert.throws(()=>manifestUrl({id:"bad",file:"../../private"}),/UNLISTED/);
});
test("R34 makes only five user-triggered, credential-free GET reads",async()=>{
 const get=mock(),result=await loadExamples(get);
 assert.equal(result.loaded,5);assert.equal(result.unavailable,0);
 assert.equal(result.runtimeConnected,false);assert.equal(result.dispatched,0);
 assert.equal(result.grantsIssued,0);assert.equal(get.calls.length,5);
 for(const c of get.calls){
  assert.equal(c.options.method,"GET");
  assert.equal(c.options.credentials,"omit");
  assert.equal(c.options.redirect,"error");
  assert.deepEqual(c.options.headers,{Accept:"application/json"});
 }
 assert.equal(result.entries[3].manifest.declaredAuthority.write,"gated");
 assert.equal(result.entries[3].manifest.running,"NOT_OBSERVED");
});
test("R34 refuses fabricated IDs, malformed capabilities and malformed authority",()=>{
 const e=EXAMPLES[0],data=fixture(e);
 assert.throws(()=>projectManifest({...data,id:"changed"},e),/IDENTITY/);
 assert.throws(()=>projectManifest({...data,capabilities:["x","x"]},e),/CAPABILITIES/);
 assert.throws(()=>projectManifest({...data,capabilities:["a;rm"]},e),/CAPABILITIES/);
 assert.throws(()=>projectManifest({...data,authority:{...data.authority,read:"true"}},e),/AUTHORITY/);
 assert.throws(()=>projectManifest({...data,description:"bad\nvalue"},e),/IDENTITY/);
});
test("R34 partial fetch never fabricates an agent presence",async()=>{
 const result=await loadExamples(mock((x,e)=>e.id==="patchbot"?{...x,id:"foreign"}:x));
 assert.equal(result.loaded,4);assert.equal(result.unavailable,1);
 assert.equal(result.entries[3].error,"R34_MANIFEST_IDENTITY");
 assert.equal(result.runtimeConnected,false);
});
test("R34 rejects failed, oversized and non-JSON responses",async()=>{
 const e=EXAMPLES[0];
 await assert.rejects(fetchExample(e,async()=>({ok:false})),/FETCH_FAILED/);
 await assert.rejects(fetchExample(e,async()=>({ok:true,text:async()=>"{x"})),/JSON_INVALID/);
 await assert.rejects(fetchExample(e,async()=>({ok:true,text:async()=>"x".repeat(10001)})),/SIZE_INVALID/);
});
test("R34 handoff is explicitly non-executable and never an approval",()=>{
 const m=projectManifest(fixture(EXAMPLES[3]),EXAMPLES[3]),txt=reviewHandoff(m);
 assert.match(txt,/NOT OBSERVED/);assert.match(txt,/neither dispatches/);
 assert.match(txt,new RegExp(SOURCE.sha));
 assert.throws(()=>reviewHandoff({...m,evidence:"LIVE"}),/UNTRUSTED_HANDOFF/);
});
