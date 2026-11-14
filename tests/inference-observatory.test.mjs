import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {inspectInferenceFiles,inferenceSummary,INFERENCE_MAX_FILE_BYTES}
  from "../src/inference-observatory.mjs";

const sha=raw=>createHash("sha256").update(raw).digest("hex");
const digest=async bytes=>sha(bytes);
const baseNow=Date.parse("2026-11-13T20:00:00Z");
const iso=ms=>new Date(ms).toISOString().replace("Z","+00:00");
const modelSha="a".repeat(64);
const modelBytes=8*1024**3;
function benchmark(layers,secondsAgo){
  const measurements=[1,2,3].map(i=>({
    index:i,wall_ms:100+i,first_content_ms:10+i,generated_chars:20,
    completion_tokens_reported:5,throughput_tps:5000/(100+i),
    response_sha256:"b".repeat(64),end_marker_observed:true
  }));
  return {
    schema:"PHISERVE_BENCHMARK_FIELD_V1",
    status:"LOCAL_OPERATOR_OBSERVATION_UNATTESTED",
    created_utc:iso(baseNow-secondsAgo*1000),
    experiment:{name:"fixed-public-prompt-v1",prompt_sha256:"e".repeat(64),
      warmups:3,trials:3},
    model:{alias:"test-gguf",gguf_sha256:modelSha,size_bytes:modelBytes},
    runtime:{binary_name:"llama-server.exe",binary_sha256:"f".repeat(64),
      phiserve_version:"0.10.0",platform_family:"Windows",startup_ms:800},
    requested:{gpu_layers:layers,ctx_size:2048,max_tokens:64,seed:42,
      temperature:0,backend_port:11436},
    measurements,
    summary:{p50_wall_ms:102,p95_wall_ms:103,p50_first_content_ms:12,
      p95_first_content_ms:13,p50_completion_tps:5000/102,
      trials_with_reported_token_counts:3},
    gpu_process_telemetry:null,
    unverified_limits:{
      prompt_or_response_text_recorded:false,
      cuda_execution_independently_verified:false,
      physical_hardware_attested:false,
      quality_evaluated:false,performance_certified:false,
      external_upload_performed:false
    }
  };
}
function setup({cuda=true}={}){
  const snapshot={
    schema:"PHISTREAM_HARDWARE_SNAPSHOT_V1",status:"OBSERVED_READ_ONLY",
    provenance:"LOCAL_HARDWARE_COUNTERS_NOT_A_BENCHMARK",
    observed_utc:iso(baseNow-15*1000),platform:"Windows-11",
    logical_cpu_count:16,
    ram:{total_bytes:32*1024**3,available_bytes:16*1024**3,
      source:"WIN32_GLOBAL_MEMORY_STATUS_EX"},
    gpu:cuda?{device:"cuda",name:"Synthetic GPU",device_index:0,
      compute_capability:"8.9",total_bytes:12*1024**3,free_bytes:6*1024**3,
      source:"TORCH_CUDA_MEM_GET_INFO",torch_version:"fake",
      cuda_build:"fake"}:null,
    gpu_requested:cuda?"cuda":"none",
    drives:[{requested_path:"C:\\Private\\VerySensitive",total_bytes:1024**4,
      free_bytes:300*1024**3,source:"PYTHON_SHUTIL_DISK_USAGE",
      throughput_measured:false}],
    limitations:["not real machine evidence"]
  };
  const snapshotText=JSON.stringify(snapshot);
  const benches=[benchmark(0,3600),benchmark(16,7200)];
  const benchText=benches.map(x=>JSON.stringify(x));
  const profiles=benches.map((b,i)=>({
    gpu_layers_requested:b.requested.gpu_layers,
    source_receipt_sha256:sha(benchText[i]),
    source_age_seconds:i?7200:3600,
    source_status:"RECENT_OPERATOR_ASSERTED",
    wall_p50_ms:102,wall_p95_ms:103,startup_ms:800,
    completion_tps_p50_reported:5000/102,reported_token_count_trials:3,
    full_gpu_weight_file_floor_met:cuda?false:null,
    gpu_execution_independently_verified:false
  }));
  const a={
    schema:"PHISERVE_HARDWARE_ADVICE_R15_V1",
    status:"REVIEW_ONLY_NOT_ROUTING_AUTHORITY",evaluated_utc:iso(baseNow),
    classification:cuda?"REVIEW_REQUIRED_CAPACITY_NOT_CONFIRMED":"HOLD_CUDA_COUNTERS_MISSING",
    source:{
      hardware_snapshot_schema:"PHISTREAM_HARDWARE_SNAPSHOT_V1",
      hardware_snapshot_file_sha256:sha(snapshotText),
      hardware_snapshot_age_seconds:15,
      hardware_snapshot_status:"RECENT_OPERATOR_ASSERTED",
      model_alias:"test-gguf",
      local_gguf_sha256:modelSha,local_gguf_file_bytes:modelBytes
    },
    capacity_floor:{
      ram_available_bytes_observed:16*1024**3,
      ram_reserve_bytes_selected:4*1024**3,
      ram_budget_bytes:12*1024**3,
      gpu_free_bytes_observed:cuda?6*1024**3:null,
      gpu_reserve_bytes_selected:1*1024**3,
      gpu_budget_bytes:cuda?5*1024**3:null,
      full_cpu_weight_file_floor_met:true,
      full_gpu_weight_file_floor_met:cuda?false:null,
      actual_model_working_set_estimated:false,
      actual_model_fit_verified:false,hybrid_offload_fit_evaluated:false
    },
    benchmark_profiles:profiles,
    comparison_limits:["GGUF size does not prove fit","Synthetic example only"],
    assurances:{
      inference_started:false,automatic_model_route:false,
      execution_authorized:false,gpu_execution_verified:false,
      physical_hardware_attested:false,performance_improvement_certified:false,
      model_quality_evaluated:false,remote_upload_performed:false
    }
  };
  return {
    a,snapshot,benches,
    files:[
      {name:"R15-advice.json",text:JSON.stringify(a)},
      {name:"private-snapshot.json",text:snapshotText},
      {name:"cpu-benchmark.json",text:benchText[0]},
      {name:"gpu-benchmark.json",text:benchText[1]}
    ]
  };
}
const parse=(files,now=baseNow)=>inspectInferenceFiles(files,{digest,now});

test("R39 displays advice alone without falsely claiming source authentication",async()=>{
  const {files}=setup();
  const r=await parse(files.slice(0,1));
  assert.equal(r.classification,"REVIEW_REQUIRED_CAPACITY_NOT_CONFIRMED");
  assert.equal(r.provenance,"UNVERIFIED_SOURCE_FILES");
  assert.equal(r.expectedSources,3);
  assert.equal(r.matchedSources,0);
  assert.equal(r.freshness,"RECENT_AT_VIEW");
  assert.equal(r.modelFitVerified,false);
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.liveConnected,false);
  assert.equal(r.gpuExecutionVerified,false);
  assert.equal(r.cpuFileFloor,true);
  assert.equal(r.gpuFileFloor,false);
});
test("R39 SHA links all selected original local files but does not authenticate producer",async()=>{
  const {files}=setup();
  const r=await parse(files);
  assert.equal(r.matchedSources,3);
  assert.equal(r.provenance,"LOCAL_BYTES_MATCH_NOT_AUTHENTICATED");
  assert.equal(r.snapshotMatched,true);
  assert.deepEqual(r.profiles.map(x=>x.sourceMatched),[true,true]);
  assert.equal(r.producerAuthenticated,false);
  assert.equal(r.profiles[1].gpuLayers,16);
  assert.ok(inferenceSummary(r).includes("Execution authorized: NO"));
  assert.ok(!JSON.stringify(r).includes("VerySensitive"));
});
test("R39 allows partial support without implying full corroboration",async()=>{
  const {files}=setup();
  const r=await parse([files[0],files[2]]);
  assert.equal(r.matchedSources,1);
  assert.equal(r.provenance,"PARTIAL_LOCAL_BYTES_MATCH");
  assert.equal(r.snapshotMatched,false);
});
test("R39 refuses unbound, modified or duplicate source JSON",async()=>{
  const {files}=setup();
  await assert.rejects(parse([files[0],{name:"unrelated.json",text:'{"foo":2}'}]),/Unexpected/);
  await assert.rejects(parse([files[0],{...files[2],text:files[2].text+" "}]),/Unexpected/);
  await assert.rejects(parse([files[0],files[2],files[2]]),/duplicate/);
});
test("R39 rejects forged live authority, GPU proof and positive fit assurance",async()=>{
  for(const [category,key] of [
    ["assurances","execution_authorized"],
    ["assurances","automatic_model_route"],
    ["assurances","gpu_execution_verified"],
    ["capacity_floor","actual_model_fit_verified"]
  ]){
    const {a,files}=setup();
    a[category][key]=true;
    files[0].text=JSON.stringify(a);
    await assert.rejects(parse([files[0]]),/authority|assurance/);
  }
});
test("R39 recomputes capacity math and refuses contradictory floors",async()=>{
  for(const [key,value] of [
    ["ram_budget_bytes",3],
    ["full_cpu_weight_file_floor_met",false],
    ["gpu_budget_bytes",999],
    ["full_gpu_weight_file_floor_met",true]
  ]){
    const {a,files}=setup();
    a.capacity_floor[key]=value;
    files[0].text=JSON.stringify(a);
    await assert.rejects(parse([files[0]]),/floor/);
  }
});
test("R39 refuses contradictory reported classification",async()=>{
  const {a,files}=setup();
  a.classification="HOLD_BENCHMARK_EVIDENCE_STALE_OR_FUTURE";
  files[0].text=JSON.stringify(a);
  await assert.rejects(parse([files[0]]),/classification/);
});
test("R39 stale-at-view overlay overrides an old producer-claimed review",async()=>{
  const {files}=setup();
  const r=await parse([files[0]],baseNow+15*60*1000);
  assert.equal(r.classification,"REVIEW_REQUIRED_CAPACITY_NOT_CONFIRMED");
  assert.equal(r.freshness,"STALE_OR_FUTURE_AT_VIEW");
});
test("R39 supports snapshot with missing GPU counters while holding GPU advice",async()=>{
  const {files}=setup({cuda:false});
  const r=await parse(files);
  assert.equal(r.classification,"HOLD_CUDA_COUNTERS_MISSING");
  assert.equal(r.gpuBudgetBytes,null);
  assert.equal(r.matchedSources,3);
  assert.equal(r.executionAuthorized,false);
});
test("R39 refuses tampered benchmark content even if advisory has unchanged hash",async()=>{
  const {files}=setup();
  const bad=JSON.parse(files[2].text);
  bad.measurements[0].throughput_tps=500000;
  files[2].text=JSON.stringify(bad);
  await assert.rejects(parse(files),/Unexpected/);
});
test("R39 checks reported benchmark trial summaries against the source",async()=>{
  const {a,files}=setup();
  const bad=JSON.parse(files[2].text);
  bad.summary.p50_wall_ms=900;
  files[2].text=JSON.stringify(bad);
  a.benchmark_profiles[0].source_receipt_sha256=sha(files[2].text);
  files[0].text=JSON.stringify(a);
  await assert.rejects(parse(files),/aggregate/);
});
test("R39 verifies snapshot counters when the original source is provided",async()=>{
  const {a,files}=setup();
  const bad=JSON.parse(files[1].text);
  bad.ram.available_bytes=15*1024**3;
  files[1].text=JSON.stringify(bad);
  a.source.hardware_snapshot_file_sha256=sha(files[1].text);
  files[0].text=JSON.stringify(a);
  await assert.rejects(parse(files),/RAM/);
});
test("R39 refuses missing advice and two advisories",async()=>{
  const {files}=setup();
  await assert.rejects(parse(files.slice(1)),/Exactly one/);
  await assert.rejects(parse([files[0],files[0]]),/Exactly one/);
});
test("R39 bounds local imports and rejects malformed JSON",async()=>{
  const {files}=setup();
  await assert.rejects(parse([{name:"broken",text:"{not-json"}]),/Invalid JSON/);
  await assert.rejects(parse([{name:"huge",text:"x".repeat(INFERENCE_MAX_FILE_BYTES+1)}]),/too large/);
  await assert.rejects(parse([]),/Select one/);
  await assert.rejects(parse(Array(11).fill(files[0])),/Select one/);
});
