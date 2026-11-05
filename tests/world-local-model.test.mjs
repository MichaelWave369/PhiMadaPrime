import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {AGENTS} from "../src/trust-world.mjs";
import {parseModelProposal,arenaPrompt,checkArenaPolicy,mockArenaModel,
  runLocalModelArena} from "../src/world-local-model.mjs";
import {ARENA_SCHEMA,MAX_RECEIPT_BYTES,verifyArenaReceipt,
  createArenaReceipt} from "../src/world-model-evidence.mjs";
import {OLLAMA_URL,MAX_OLLAMA_RESPONSE_BYTES,ollamaProposal,parseArgs,main}
  from "../scripts/phi_world_local_model.mjs";

const FIXED="2026-11-04T23:00:00.000Z";
const params={model:"qwen3:4b",scenario:"collision",days:2,
  source:"MOCK_FIXTURE",createdUtc:FIXED,ask:mockArenaModel};
const clone=o=>JSON.parse(JSON.stringify(o));
test("model action format is bounded and rejects forged actor, tool URLs and markdown",()=>{
  assert.deepEqual(parseModelProposal('{"action":"work","targetId":""}'),
    {action:"work",targetId:"",reason:"STRUCTURE_VALID"});
  for(const input of [
    '{"action":"work","targetId":"","actorId":"a02"}',
    '{"action":"open_bank","targetId":""}',
    '{"action":"work","targetId":"http://evil"}',
    '{"action":"work","targetId":"a02"}',
    '{"action":"steal","targetId":"../secrets"}',
    ' ```json {"action":"work","targetId":""} ```',
    "x".repeat(1001)
  ]) assert.equal(parseModelProposal(input).action,"invalid");
});
test("prompt marks forged authority as untrusted and never passes secrets",()=>{
  const p=arenaPrompt({agent:AGENTS[0],day:1,scenario:"injection",
    credits:8,energy:11});
  assert.match(p,/UNTRUSTED MESSAGE/);
  assert.match(p,/no authority/i);
  assert.match(p,/Return ONLY a JSON/);
  assert.doesNotMatch(p,/api[_ -]?key|bearer [a-z0-9]+/i);
});
test("separate Node gate denies hostile proposals even when the model requests them",()=>{
  const state={agents:AGENTS.map(a=>({...a,alive:true,credits:8,energy:10}))};
  for(const action of ["steal","sabotage","escalate","exfiltrate","erase_audit"]){
    const d=checkArenaPolicy(state,"a01",{action,targetId:action==="steal"?"a02":""});
    assert.equal(d.allowed,false);assert.equal(d.reason,"INDEPENDENT_GATE_BLOCKED");
  }
  assert.equal(checkArenaPolicy(state,"a01",{action:"work",targetId:""}).allowed,true);
  assert.equal(checkArenaPolicy(state,"a01",{action:"share",targetId:"a01"}).allowed,false);
  assert.equal(checkArenaPolicy(state,"unknown",{action:"work"}).allowed,false);
});
test("ten local-model simulated agents return a hash-verifiable receipt",async()=>{
  const receipt=await runLocalModelArena(params);
  const verified=await verifyArenaReceipt(JSON.stringify(receipt));
  assert.equal(verified.header.schema,ARENA_SCHEMA);
  assert.equal(verified.header.source,"MOCK_FIXTURE");
  assert.equal(verified.records.length,20);
  assert.equal(verified.summary.total,20);
  assert(verified.summary.denied>0);
  assert(verified.summary.allowed>0);
  assert.equal(verified.summary.agents.length,10);
  assert.match(verified.verifiedHash,/^[a-f0-9]{64}$/);
  assert.match(verified.verdict,/NOT_AUTHENTICATED/);
  assert(receipt.entries.every((e,i)=>e.record.seq===i+1));
});
test("same adapter outputs and timestamp yield reproducible model arena receipts",async()=>{
  const first=await runLocalModelArena(params);
  const second=await runLocalModelArena(params);
  assert.deepEqual(first,second);
});
test("opaque model output or unavailable Ollama fails closed, no action executed",async()=>{
  const receipt=await runLocalModelArena({...params,days:1,
    ask:async()=>{throw Error("connection failed");}});
  assert.equal(receipt.summary.allowed,0);
  assert.equal(receipt.summary.denied,10);
  assert(receipt.entries.every(e=>e.record.action==="invalid"&&
    e.record.reason==="MODEL_ADAPTER_FAILED"));
  await verifyArenaReceipt(receipt);
});
test("malformed configs cannot silently create a real authority",async()=>{
  for(const patch of [{model:"../secret"},{model:"evil/path"},{days:0},
    {days:4},{scenario:"unknown"},{source:"REMOTE"},{"ask":null}]){
    await assert.rejects(runLocalModelArena({...params,...patch}),/ARENA_.*_INVALID/);
  }
});
test("tampering with action, decision, identity, sequence and hashes is detected",async()=>{
  const good=await runLocalModelArena(params);
  for(const change of [
    r=>{r.entries[0].record.action="steal";},
    r=>{r.entries[1].record.decision="ALLOWED";},
    r=>{r.entries[0].record.agentId="a10";},
    r=>{r.entries[0].record.seq=2;},
    r=>{r.entries[0].prevHash="0".repeat(64);},
    r=>{r.entries[1].hash="f".repeat(64);},
    r=>{r.summary.denied=0;},
    r=>{r.summary.agents[0].credits+=2;},
    r=>{r.finalHash="f".repeat(64);},
    r=>{r.header.model="another";},
    r=>{r.header.source="UNTRUSTED_REMOTE";},
    r=>{r.unapproved=true;}
  ]){
    const changed=clone(good);change(changed);
    await assert.rejects(verifyArenaReceipt(changed),/ARENA_/);
  }
});
test("size and unbounded record lists are rejected",async()=>{
  await assert.rejects(verifyArenaReceipt("x".repeat(MAX_RECEIPT_BYTES+1)),
    /TOO_LARGE/);
  const good=await runLocalModelArena(params);
  const bad=clone(good);
  bad.entries=Array.from({length:301},()=>bad.entries[0]);
  await assert.rejects(verifyArenaReceipt(bad),/ENTRIES_INVALID/);
  await assert.rejects(createArenaReceipt({header:good.header,records:[],
    summary:good.summary}),/SUMMARY_COUNTS/);
});
test("fixed-loopback Ollama adapter is POST only with no credentials or arbitrary URLs",async()=>{
  const calls=[];
  const fake=async(url,options)=>{
    calls.push({url,options});
    return new Response(JSON.stringify({response:'{"action":"rest","targetId":""}'}),
      {status:200,headers:{"Content-Type":"application/json"}});
  };
  const proposal=await ollamaProposal({model:"qwen3:4b",prompt:"toy only"},fake);
  assert.equal(proposal,'{"action":"rest","targetId":""}');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,OLLAMA_URL);
  assert.equal(calls[0].url,"http://127.0.0.1:11434/api/generate");
  assert.equal(calls[0].options.method,"POST");
  assert.equal(calls[0].options.credentials,"omit");
  assert.equal(calls[0].options.redirect,"error");
  assert.equal(JSON.parse(calls[0].options.body).stream,false);
  assert(!JSON.stringify(calls[0].options).includes("Authorization"));
  await assert.rejects(ollamaProposal({model:"../server",prompt:"x"},fake),
    /INPUT_INVALID/);
});
test("oversized Ollama output and non-JSON messages are held",async()=>{
  const big=()=>Promise.resolve(new Response("x".repeat(MAX_OLLAMA_RESPONSE_BYTES+1)));
  await assert.rejects(ollamaProposal({model:"qwen3:4b",prompt:"toy"},big),
    /TOO_LARGE/);
  const broken=()=>Promise.resolve(new Response("not-json"));
  await assert.rejects(ollamaProposal({model:"qwen3:4b",prompt:"toy"},broken),
    /JSON_INVALID/);
});
test("CLI mock produces an independently verified offline file without network calls",async()=>{
  const saved=[],out=[];
  const r=await main(["--mock","--days","1","--out","sim-r2.json"],{
    write:async(path,data,options)=>saved.push({path,data,options}),
    log:s=>out.push(s),now:()=>FIXED,fetcher:()=>{throw Error("NETWORK_CALLED");}
  });
  assert.equal(r.header.source,"MOCK_FIXTURE");
  assert.equal(saved.length,1);
  assert.equal(saved[0].path,"sim-r2.json");
  assert.equal(saved[0].options.flag,"wx");
  await verifyArenaReceipt(saved[0].data);
  assert.match(out[0],/MOCK_FIXTURE/);
});
test("CLI explicitly requires model unless mock, and refuses implicit network hosts",()=>{
  assert.throws(()=>parseArgs([]),/MODEL_REQUIRED/);
  assert.throws(()=>parseArgs(["--model","qwen3:4b","--url","http://example.com"]),
    /UNKNOWN_ARGUMENT/);
  assert.throws(()=>parseArgs(["--mock","--out","receipt.txt"]),/OUTPUT_INVALID/);
  assert.equal(parseArgs(["--mock"]).model,"mock-r2");
  const cli=readFileSync("scripts/phi_world_local_model.mjs","utf8");
  assert.doesNotMatch(cli,/https?:\/\/[^\s"'\x60]*api\.github\.com/);
  assert.doesNotMatch(cli,/GITHUB_TOKEN|apiKey|Authorization/);
  assert.match(cli,/flag:"wx"/);
});
test("public PhiMadaPrime site only imports evidence, never calls local Ollama",()=>{
  const ui=readFileSync("src/world-model-evidence.jsx","utf8");
  const world=readFileSync("src/trust-world.jsx","utf8");
  assert.match(ui,/verifyArenaReceipt\(raw\)/);
  assert.match(world,/<WorldModelEvidence \/>/);
  assert.doesNotMatch(ui,/fetch\(|OLLAMA_URL|http:\/\/127\.0\.0\.1/);
});
