#!/usr/bin/env node
// R2 opt-in local Ollama-only runner. No listener, GitHub token, or real tools.
// Deliberately fixed to 127.0.0.1; no URL or model-supplied endpoint option.
import {writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {runLocalModelArena,mockArenaModel} from "../src/world-local-model.mjs";
import {verifyArenaReceipt} from "../src/world-model-evidence.mjs";

export const OLLAMA_URL="http://127.0.0.1:11434/api/generate";
export const MAX_OLLAMA_RESPONSE_BYTES=64_000;
export function parseArgs(argv){
  const args={mock:false,days:1,scenario:"collision",model:null,
    out:"phi-world-local-r2.json"};
  for(let i=0;i<argv.length;i++){
    const flag=argv[i];
    if(flag==="--mock"){args.mock=true;continue;}
    if(flag==="--help"){args.help=true;continue;}
    if(!["--model","--days","--scenario","--out"].includes(flag))
      throw Error("ARENA_CLI_UNKNOWN_ARGUMENT: "+flag);
    const value=argv[++i];
    if(typeof value!=="string"||!value||value.startsWith("--"))
      throw Error("ARENA_CLI_MISSING_VALUE: "+flag);
    if(flag==="--model")args.model=value;
    if(flag==="--days")args.days=Number(value);
    if(flag==="--scenario")args.scenario=value;
    if(flag==="--out")args.out=value;
  }
  if(args.help)return args;
  if(!args.mock&&!args.model)throw Error("ARENA_CLI_MODEL_REQUIRED");
  if(args.mock&&!args.model)args.model="mock-r2";
  if(typeof args.out!=="string"||args.out.length>240||
    /[\x00-\x1f]/.test(args.out)||!args.out.endsWith(".json"))
    throw Error("ARENA_CLI_OUTPUT_INVALID");
  return args;
}
async function readBounded(response){
  if(!response?.ok)throw Error("ARENA_OLLAMA_HTTP_ERROR");
  if(!response.body?.getReader)throw Error("ARENA_OLLAMA_BODY_INVALID");
  const reader=response.body.getReader(),buffers=[];
  let bytes=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>MAX_OLLAMA_RESPONSE_BYTES)throw Error("ARENA_OLLAMA_TOO_LARGE");
      buffers.push(value);
    }
  }finally{reader.releaseLock();}
  const combined=new Uint8Array(bytes);
  let offset=0;
  for(const part of buffers){combined.set(part,offset);offset+=part.byteLength;}
  return new TextDecoder("utf-8",{fatal:true}).decode(combined);
}
export async function ollamaProposal({model,prompt},fetcher=globalThis.fetch){
  if(typeof model!=="string"||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/.test(model)||
    typeof prompt!=="string"||prompt.length>2400)
    throw Error("ARENA_OLLAMA_INPUT_INVALID");
  if(typeof fetcher!=="function")throw Error("ARENA_OLLAMA_UNAVAILABLE");
  const response=await fetcher(OLLAMA_URL,{
    method:"POST",redirect:"error",credentials:"omit",cache:"no-store",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({model,prompt,stream:false,format:"json",
      options:{temperature:0,num_predict:120}}),
    signal:AbortSignal.timeout(30_000)
  });
  const body=await readBounded(response);
  let json;
  try{json=JSON.parse(body);}catch{throw Error("ARENA_OLLAMA_JSON_INVALID");}
  if(typeof json.response!=="string"||json.response.length>1000)
    throw Error("ARENA_OLLAMA_PROPOSAL_INVALID");
  return json.response;
}
export async function main(argv=process.argv.slice(2),deps={}){
  const args=parseArgs(argv);
  if(args.help){
    (deps.log||console.log)(
      "Usage: node scripts/phi_world_local_model.mjs [--mock] [--model qwen3:4b] "+
      "[--scenario collision|commons|scarcity|injection] [--days 1..3] "+
      "[--out phi-world-local-r2.json]\n"+
      "Only local Ollama 127.0.0.1 is contacted when --mock is absent; no real tools are exposed.");
    return null;
  }
  const ask=args.mock?async(x)=>mockArenaModel(x):
    x=>ollamaProposal(x,deps.fetcher||globalThis.fetch);
  const receipt=await runLocalModelArena({
    model:args.model,source:args.mock?"MOCK_FIXTURE":"LOCAL_OLLAMA",
    scenario:args.scenario,days:args.days,ask,
    createdUtc:(deps.now||(()=>new Date().toISOString()))()
  });
  await verifyArenaReceipt(receipt);
  const data=JSON.stringify(receipt,null,2)+"\n";
  // Exclusive create: never quietly overwrite previous local evidence.
  await (deps.write||writeFile)(args.out,data,{flag:"wx",mode:0o600});
  (deps.log||console.log)("Φ World R2: "+receipt.summary.total+
    " proposals/events · "+receipt.summary.denied+" denied · "+
    receipt.summary.active+" active · "+receipt.header.source+
    " · saved to "+args.out);
  const failed=receipt.entries.filter(e=>e.record.reason==="MODEL_ADAPTER_FAILED").length;
  if(failed>0)(deps.warn||console.warn)(
    failed+" model calls failed closed; inspect evidence, confirm Ollama is running.");
  return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().then(receipt=>{
    if(receipt?.entries.some(e=>e.record.reason==="MODEL_ADAPTER_FAILED"))
      process.exitCode=2;
  }).catch(error=>{
    console.error("Φ World R2 held: "+error.message);
    process.exitCode=1;
  });
}
