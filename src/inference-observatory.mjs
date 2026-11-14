// R46: browser-memory-only consumer for PhiServe R15 advisory + optional R13/PhiStream sources.
// Matching file hashes establish local byte consistency only, never producer identity,
// model execution, GPU execution, calibration, permission, or validated facts.
export const INFERENCE_MAX_FILE_BYTES = 1_048_576;
const SHA = /^[a-f0-9]{64}$/;
const CLASSIFICATIONS = new Set([
  "HOLD_HARDWARE_OBSERVATION_STALE_OR_FUTURE",
  "HOLD_BENCHMARK_EVIDENCE_STALE_OR_FUTURE",
  "HOLD_CUDA_COUNTERS_MISSING",
  "REVIEW_REQUIRED_CAPACITY_NOT_CONFIRMED"
]);
const STATES = new Set(["RECENT_OPERATOR_ASSERTED","HOLD_FUTURE_TIMESTAMP","HOLD_STALE_EVIDENCE"]);
const ASSERTIONS = [
  "inference_started","automatic_model_route","execution_authorized",
  "gpu_execution_verified","physical_hardware_attested",
  "performance_improvement_certified","model_quality_evaluated",
  "remote_upload_performed"
];
const byteLength = s => new TextEncoder().encode(s).byteLength;
const obj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const fail = message => { throw Error(message); };
const ensure = (condition,message) => { if (!condition) fail(message); };
const keys = (v,k,label) => ensure(obj(v) && Object.keys(v).sort().join("|") === k.slice().sort().join("|"),"Invalid "+label+" fields");
const hex = v => typeof v === "string" && SHA.test(v);
const nonnegative = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
const nat = v => Number.isSafeInteger(v) && v >= 0;
const utf = v => typeof v === "string" && v.length > 0 && v.length <= 256 && !/[\r\n\0]/.test(v);
const close = (a,b) => Math.abs(a-b) <= Math.max(0.001,Math.abs(b)*1e-8);
function when(iso,label) {
  ensure(typeof iso === "string" && iso.length <= 48 && iso.length >= 20 &&
    (/Z$|\+00:00$/.test(iso)) && Number.isFinite(Date.parse(iso)),
    "Invalid "+label+" UTC time");
  return Date.parse(iso);
}
function fileJSON(text,limit=INFERENCE_MAX_FILE_BYTES) {
  ensure(typeof text === "string" && byteLength(text) > 1 && byteLength(text) <= limit,
    "File is empty or too large");
  try { return JSON.parse(text); } catch { fail("Invalid JSON"); }
}
function advisoryShape(a) {
  keys(a,["schema","status","evaluated_utc","classification","source",
          "capacity_floor","benchmark_profiles","comparison_limits","assurances"],"advice");
  ensure(a.schema === "PHISERVE_HARDWARE_ADVICE_R15_V1" &&
    a.status === "REVIEW_ONLY_NOT_ROUTING_AUTHORITY" &&
    CLASSIFICATIONS.has(a.classification),"Not a supported PhiServe R15 review receipt");
  const evaluated = when(a.evaluated_utc,"evaluation");
  keys(a.source,["hardware_snapshot_schema","hardware_snapshot_file_sha256",
    "hardware_snapshot_age_seconds","hardware_snapshot_status","model_alias",
    "local_gguf_sha256","local_gguf_file_bytes"],"source");
  const s = a.source;
  ensure(s.hardware_snapshot_schema === "PHISTREAM_HARDWARE_SNAPSHOT_V1" &&
    hex(s.hardware_snapshot_file_sha256) && hex(s.local_gguf_sha256) &&
    utf(s.model_alias) && nat(s.local_gguf_file_bytes) && s.local_gguf_file_bytes >= 4 &&
    typeof s.hardware_snapshot_age_seconds === "number" &&
    Number.isFinite(s.hardware_snapshot_age_seconds) &&
    STATES.has(s.hardware_snapshot_status),"Malformed source identity");
  keys(a.capacity_floor,["ram_available_bytes_observed","ram_reserve_bytes_selected",
    "ram_budget_bytes","gpu_free_bytes_observed","gpu_reserve_bytes_selected",
    "gpu_budget_bytes","full_cpu_weight_file_floor_met",
    "full_gpu_weight_file_floor_met","actual_model_working_set_estimated",
    "actual_model_fit_verified","hybrid_offload_fit_evaluated"],"capacity");
  const c = a.capacity_floor;
  for (const key of ["ram_available_bytes_observed","ram_reserve_bytes_selected",
                    "ram_budget_bytes","gpu_reserve_bytes_selected"])
    ensure(nat(c[key]),"Malformed RAM or reserve counter");
  ensure(c.ram_budget_bytes === Math.max(0,c.ram_available_bytes_observed-c.ram_reserve_bytes_selected) &&
    c.full_cpu_weight_file_floor_met === (s.local_gguf_file_bytes <= c.ram_budget_bytes),
    "RAM floor cannot be reproduced");
  ensure(c.actual_model_working_set_estimated === false && c.actual_model_fit_verified === false &&
    c.hybrid_offload_fit_evaluated === false,"Unsupported model-fit assurance");
  if (c.gpu_free_bytes_observed === null) {
    ensure(c.gpu_budget_bytes === null && c.full_gpu_weight_file_floor_met === null,
      "Missing GPU counters cannot support a GPU floor");
  } else {
    ensure(nat(c.gpu_free_bytes_observed) && nat(c.gpu_budget_bytes) &&
      c.gpu_budget_bytes === Math.max(0,c.gpu_free_bytes_observed-c.gpu_reserve_bytes_selected) &&
      c.full_gpu_weight_file_floor_met === (s.local_gguf_file_bytes <= c.gpu_budget_bytes),
      "GPU floor cannot be reproduced");
  }
  keys(a.assurances,ASSERTIONS,"assurances");
  ensure(ASSERTIONS.every(k => a.assurances[k] === false),
    "Receipt claims execution or approval authority");
  ensure(Array.isArray(a.comparison_limits) && a.comparison_limits.length > 0 &&
    a.comparison_limits.length <= 20 &&
    a.comparison_limits.every(x => typeof x === "string" && x.length <= 1000),
    "Missing review limitations");
  ensure(Array.isArray(a.benchmark_profiles) &&
    a.benchmark_profiles.length >= 1 && a.benchmark_profiles.length <= 8,
    "Unexpected benchmark profile count");
  const profiles = [],seen = new Set();
  for (const p of a.benchmark_profiles) {
    keys(p,["gpu_layers_requested","source_receipt_sha256","source_age_seconds",
      "source_status","wall_p50_ms","wall_p95_ms","startup_ms",
      "completion_tps_p50_reported","reported_token_count_trials",
      "full_gpu_weight_file_floor_met","gpu_execution_independently_verified"],"profile");
    ensure(nat(p.gpu_layers_requested) && p.gpu_layers_requested <= 1024 &&
      !seen.has(p.gpu_layers_requested),"Duplicate or invalid offload profile");
    seen.add(p.gpu_layers_requested);
    ensure(hex(p.source_receipt_sha256) &&
      typeof p.source_age_seconds === "number" && Number.isFinite(p.source_age_seconds) &&
      STATES.has(p.source_status) &&
      nonnegative(p.wall_p50_ms) && nonnegative(p.wall_p95_ms) &&
      p.wall_p95_ms >= p.wall_p50_ms && nonnegative(p.startup_ms) &&
      (p.completion_tps_p50_reported === null || nonnegative(p.completion_tps_p50_reported)) &&
      nat(p.reported_token_count_trials) && p.reported_token_count_trials <= 30 &&
      p.full_gpu_weight_file_floor_met === c.full_gpu_weight_file_floor_met &&
      p.gpu_execution_independently_verified === false,
      "Invalid profile measurement or false hardware claim");
    profiles.push(p);
  }
  ensure((s.hardware_snapshot_status !== "RECENT_OPERATOR_ASSERTED"
    ? a.classification === "HOLD_HARDWARE_OBSERVATION_STALE_OR_FUTURE"
    : profiles.some(x => x.source_status !== "RECENT_OPERATOR_ASSERTED")
      ? a.classification === "HOLD_BENCHMARK_EVIDENCE_STALE_OR_FUTURE"
      : profiles.some(x => x.gpu_layers_requested > 0) && c.gpu_free_bytes_observed === null
        ? a.classification === "HOLD_CUDA_COUNTERS_MISSING"
        : a.classification === "REVIEW_REQUIRED_CAPACITY_NOT_CONFIRMED"),
    "Advice classification contradicts evidence states");
  return {a,s,c,profiles,evaluated};
}
async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) fail("Web Crypto unavailable; use HTTPS or localhost");
  const digest = await globalThis.crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
}
function snapshotShape(d,a) {
  ensure(obj(d) && d.schema === "PHISTREAM_HARDWARE_SNAPSHOT_V1" &&
    d.status === "OBSERVED_READ_ONLY" &&
    d.provenance === "LOCAL_HARDWARE_COUNTERS_NOT_A_BENCHMARK",
    "Unsupported PhiStream snapshot");
  ensure(nat(d.ram?.available_bytes) &&
    d.ram.available_bytes === a.capacity_floor.ram_available_bytes_observed,
    "Snapshot RAM counter does not match advice");
  const gpu = d.gpu_requested === "cuda" ? d.gpu?.free_bytes : null;
  ensure((gpu === null || nat(gpu)) &&
    gpu === a.capacity_floor.gpu_free_bytes_observed,
    "Snapshot CUDA counter does not match advice");
  const sourceAge = +((Date.parse(a.evaluated_utc)-when(d.observed_utc,"snapshot"))/1000).toFixed(3);
  ensure(close(sourceAge,a.source.hardware_snapshot_age_seconds),
    "Snapshot age does not match advice");
}
function median(v) { const s = [...v].sort((a,b)=>a-b),n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2; }
function p95(v) { return [...v].sort((a,b)=>a-b)[Math.ceil(v.length*.95)-1]; }
function benchmarkShape(d,a,profile) {
  ensure(obj(d) && d.schema === "PHISERVE_BENCHMARK_FIELD_V1" &&
    d.status === "LOCAL_OPERATOR_OBSERVATION_UNATTESTED" &&
    d.model?.alias === a.source.model_alias &&
    d.model.gguf_sha256 === a.source.local_gguf_sha256 &&
    d.model.size_bytes === a.source.local_gguf_file_bytes &&
    d.requested?.gpu_layers === profile.gpu_layers_requested &&
    d.unverified_limits?.cuda_execution_independently_verified === false &&
    d.unverified_limits?.physical_hardware_attested === false &&
    d.unverified_limits?.performance_certified === false &&
    d.unverified_limits?.quality_evaluated === false,
    "Benchmark identity or assurance mismatch");
  const rows = d.measurements;
  ensure(Array.isArray(rows) && rows.length >= 3 && rows.length <= 30 &&
    d.experiment?.trials === rows.length,"Invalid benchmark trials");
  for (const [i,r] of rows.entries()) {
    ensure(r.index === i+1 && nonnegative(r.wall_ms) && r.wall_ms > 0 &&
      nonnegative(r.first_content_ms) && r.first_content_ms <= r.wall_ms &&
      r.end_marker_observed === true &&
      (r.throughput_tps === null || nonnegative(r.throughput_tps)),
      "Contradictory benchmark trial");
    if (r.completion_tokens_reported === null) ensure(r.throughput_tps === null,"Invented token throughput");
    else ensure(nat(r.completion_tokens_reported) && r.completion_tokens_reported > 0 &&
      close(r.completion_tokens_reported*1000/r.wall_ms,r.throughput_tps),
      "Reported throughput disagrees with token count");
  }
  const wall = rows.map(r=>r.wall_ms);
  const tps = rows.filter(r=>r.throughput_tps !== null).map(r=>r.throughput_tps);
  ensure(close(median(wall),d.summary?.p50_wall_ms) &&
    close(p95(wall),d.summary.p95_wall_ms) &&
    close(d.summary.p50_wall_ms,profile.wall_p50_ms) &&
    close(d.summary.p95_wall_ms,profile.wall_p95_ms) &&
    close(d.runtime?.startup_ms,profile.startup_ms) &&
    d.summary.trials_with_reported_token_counts === tps.length &&
    profile.reported_token_count_trials === tps.length &&
    (tps.length ? (close(median(tps),d.summary.p50_completion_tps) &&
      close(median(tps),profile.completion_tps_p50_reported)) :
      (d.summary.p50_completion_tps === null && profile.completion_tps_p50_reported === null)),
    "Benchmark aggregate or profile mismatch");
  const age = +((Date.parse(a.evaluated_utc)-when(d.created_utc,"benchmark"))/1000).toFixed(3);
  ensure(close(age,profile.source_age_seconds),"Benchmark age mismatch");
}
export async function inspectInferenceFiles(files,{digest=sha256,now=Date.now()}={}) {
  ensure(Array.isArray(files) && files.length>0 && files.length<=10,
    "Select one advisory and up to nine source JSON files");
  const parsed = files.map(f=>{
    ensure(f && typeof f.name === "string" && f.name.length<=256,"Invalid selected file");
    const body = fileJSON(f.text);
    return {...f,body,bytes:new TextEncoder().encode(f.text)};
  });
  const adviceFiles = parsed.filter(x=>x.body?.schema === "PHISERVE_HARDWARE_ADVICE_R15_V1");
  ensure(adviceFiles.length === 1,"Exactly one PhiServe R15 advisory is required");
  const {a,s,c,profiles,evaluated} = advisoryShape(adviceFiles[0].body);
  ensure(Number.isFinite(now) && now>=0,"Invalid review clock");
  const sourceFiles = parsed.filter(x=>x!==adviceFiles[0]);
  const expected = [s.hardware_snapshot_file_sha256,...profiles.map(p=>p.source_receipt_sha256)];
  ensure(new Set(expected).size === expected.length,"Duplicate source hash references");
  const matched = new Set();
  for (const f of sourceFiles) {
    const hash = await digest(f.bytes);
    ensure(hex(hash),"Invalid source hash result");
    ensure(expected.includes(hash) && !matched.has(hash),
      "Unexpected or duplicate source file; select only bound original JSON sources");
    if (hash === s.hardware_snapshot_file_sha256) snapshotShape(f.body,a);
    else benchmarkShape(f.body,a,profiles.find(p=>p.source_receipt_sha256===hash));
    matched.add(hash);
  }
  const ageSeconds = (now-evaluated)/1000;
  const snapshotAgeAtView = s.hardware_snapshot_age_seconds+ageSeconds;
  const benchAges = profiles.map(p=>p.source_age_seconds+ageSeconds);
  const freshAtView = ageSeconds>=-60 && snapshotAgeAtView>=-60 &&
    snapshotAgeAtView<=300 && benchAges.every(age=>age>=-60&&age<=7*86400);
  const allSourcesMatched = matched.size===expected.length;
  return {
    schema:a.schema,classification:a.classification,
    alias:s.model_alias,modelSha:s.local_gguf_sha256,modelBytes:s.local_gguf_file_bytes,
    evaluatedUtc:a.evaluated_utc,ageSeconds,
    freshness:freshAtView?"RECENT_AT_VIEW":"STALE_OR_FUTURE_AT_VIEW",
    provenance:allSourcesMatched?"LOCAL_BYTES_MATCH_NOT_AUTHENTICATED":
      matched.size?"PARTIAL_LOCAL_BYTES_MATCH":"UNVERIFIED_SOURCE_FILES",
    matchedSources:matched.size,expectedSources:expected.length,
    ramAvailableBytes:c.ram_available_bytes_observed,ramBudgetBytes:c.ram_budget_bytes,
    gpuFreeBytes:c.gpu_free_bytes_observed,gpuBudgetBytes:c.gpu_budget_bytes,
    cpuFileFloor:c.full_cpu_weight_file_floor_met,
    gpuFileFloor:c.full_gpu_weight_file_floor_met,
    profiles:profiles.map(p=>({
      gpuLayers:p.gpu_layers_requested,p50:p.wall_p50_ms,p95:p.wall_p95_ms,
      startupMs:p.startup_ms,tps:p.completion_tps_p50_reported,
      tokensObserved:p.reported_token_count_trials,
      sourceMatched:matched.has(p.source_receipt_sha256),
      sourceStatus:p.source_status,
    })),
    snapshotMatched:matched.has(s.hardware_snapshot_file_sha256),
    executionAuthorized:false,modelFitVerified:false,gpuExecutionVerified:false,
    producerAuthenticated:false,qualityVerified:false,liveConnected:false,
    warning:"Only user-selected local JSON. Matching SHA-256 binds file bytes, not producer identity or physical hardware. R15 review classification is never execution permission."
  };
}
export function inferenceSummary(report) {
  ensure(report && report.schema==="PHISERVE_HARDWARE_ADVICE_R15_V1","Missing reviewed inference report");
  return [
    "PHIMADA PRIME / PHISERVE R15 / OBSERVATORY R46 / REVIEW ONLY",
    "Model alias: "+report.alias,
    "Evaluation (producer-claimed): "+report.evaluatedUtc,
    "Classification (producer-claimed): "+report.classification,
    "Freshness at view: "+report.freshness,
    "Source bytes matched: "+report.matchedSources+"/"+report.expectedSources,
    "Producer/hardware identity authenticated: NO",
    "Execution authorized: NO; model fit verified: NO; GPU execution verified: NO",
    "Profiles: "+report.profiles.map(p=>
      "GPU layers requested "+p.gpuLayers+": p50 "+p.p50+" ms, p95 "+p.p95+" ms").join(" | ")
  ].join("\n");
}
