import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  pipelineTemplate,inspectPipeline,parsePipelineText,serializePipeline,
  MAX_PIPELINE_BYTES
} from "../src/verified-pipeline.mjs";
const clone=x=>structuredClone(x);

test("R1 six-stage template is a design, never a verified execution",()=>{
  const p=pipelineTemplate(),r=inspectPipeline(p);
  assert.deepEqual(p.nodes.map(n=>n.kind),[
    "request","plan","evidence","verify","review","result"
  ]);
  assert.equal(r.state,"DESIGN_VALID_NOT_RUN");
  assert.equal(r.valid,true);
  assert.equal(r.runStatus,"NOT_RUN");
  assert.equal(r.executionAuthorized,false);
  assert.deepEqual(r.permissions,[]);
});
test("forged statuses and unknown privilege keys cannot pass schema",()=>{
  const p=pipelineTemplate();
  p.execution.status="VERIFIED";
  assert.equal(inspectPipeline(p).state,"INVALID_SCHEMA");
  p.execution.status="NOT_RUN";
  p.execution.enabled=true;
  assert.equal(inspectPipeline(p).state,"INVALID_SCHEMA");
  p.execution.enabled=false;
  p.execution.permissions=["git-write"];
  assert.equal(inspectPipeline(p).state,"INVALID_SCHEMA");
  p.execution.permissions=[];
  p.hidden_tool_authority=true;
  assert.equal(inspectPipeline(p).state,"INVALID_SCHEMA");
});
test("direct route to result bypasses the independent gates",()=>{
  const p=pipelineTemplate();
  p.edges.push({id:"bypass",source:"request",target:"result"});
  const x=inspectPipeline(p);
  assert.equal(x.state,"INVALID_GRAPH");
  assert.match(x.issues.join(" "),/bypasses/);
});
test("a review node before verification fails",()=>{
  const p=pipelineTemplate();
  p.edges=[
    {id:"e-1",source:"request",target:"plan"},
    {id:"e-2",source:"plan",target:"evidence"},
    {id:"e-3",source:"evidence",target:"review"},
    {id:"e-4",source:"review",target:"verify"},
    {id:"e-5",source:"verify",target:"result"}
  ];
  assert.equal(inspectPipeline(p).state,"INVALID_GRAPH");
});
test("a verification path that skips evidence fails",()=>{
  const p=pipelineTemplate();
  p.edges.push({id:"bypass",source:"plan",target:"verify"});
  assert.equal(inspectPipeline(p).state,"INVALID_GRAPH");
});
test("cycles and unconnected stages fail closed",()=>{
  const p=pipelineTemplate();
  p.edges.push({id:"cycle",source:"review",target:"plan"});
  assert.match(inspectPipeline(p).issues.join(" "),/Cycles/);
  const q=pipelineTemplate();
  q.nodes.push({id:"orphan",kind:"plan",label:"Orphan",position:{x:0,y:0}});
  assert.equal(inspectPipeline(q).state,"INVALID_GRAPH");
});
test("duplicate ID, nonexistent endpoint and self-link are blocked",()=>{
  const p=pipelineTemplate();
  p.nodes.push(clone(p.nodes[0]));
  assert.match(inspectPipeline(p).issues.join(" "),/Duplicate node/);
  p.nodes.pop();
  p.edges.push({id:"e-1",source:"plan",target:"result"});
  assert.match(inspectPipeline(p).issues.join(" "),/Duplicate edge/);
  p.edges.pop();
  p.edges.push({id:"missing",source:"absent",target:"result"});
  assert.match(inspectPipeline(p).issues.join(" "),/Unknown edge/);
  p.edges.pop();
  p.edges.push({id:"self",source:"review",target:"review"});
  assert.match(inspectPipeline(p).issues.join(" "),/Self-link/);
});
test("design JSON roundtrip contains no credentials or receipts",()=>{
  const original=pipelineTemplate();
  const roundtrip=parsePipelineText(serializePipeline(original));
  assert.deepEqual(roundtrip,original);
  assert.equal(roundtrip.execution.status,"NOT_RUN");
  assert.equal(roundtrip.execution.enabled,false);
});
test("malicious-looking labels are inert React text",()=>{
  const p=pipelineTemplate();
  p.nodes[1].label="<img src=x onerror=alert(1)>";
  const q=parsePipelineText(serializePipeline(p));
  assert.equal(q.nodes[1].label,p.nodes[1].label);
  const jsx=readFileSync(new URL("../src/verified-pipeline.jsx",import.meta.url),"utf8");
  assert.doesNotMatch(jsx,/dangerouslySetInnerHTML|eval\s*\(/);
});
test("JSON parser rejects oversize, malformed, and execution-grant documents",()=>{
  assert.throws(()=>parsePipelineText("a".repeat(MAX_PIPELINE_BYTES+1)),/64 KiB/);
  assert.throws(()=>parsePipelineText("{oops"),/Invalid pipeline JSON/);
  const p=pipelineTemplate();p.document_kind="PHI_PIPELINE_EXECUTOR";
  assert.throws(()=>parsePipelineText(JSON.stringify(p)),/schema or authority/);
});
test("unknown node types, NaN and invalid coordinates cannot pass",()=>{
  const p=pipelineTemplate();p.nodes[1].kind="remote_shell";
  assert.equal(inspectPipeline(p).state,"INVALID_SCHEMA");
  p.nodes[1].kind="plan";p.nodes[1].position.x=Infinity;
  assert.equal(inspectPipeline(p).state,"INVALID_SCHEMA");
});
test("one integrated ThinkTank includes all existing evidence rooms",()=>{
  const shell=readFileSync(new URL("../src/thinktank.jsx",import.meta.url),"utf8");
  assert.match(shell,/VerifiedPipelineFactory/);
  for(const label of ["Mission Router","Evidence & Trust","Council Provenance","Three-Brain Ledger"]){
    assert.match(shell,new RegExp(label));
  }
});
test("UI has no background tool executor or browser persistence",()=>{
  const jsx=readFileSync(new URL("../src/verified-pipeline.jsx",import.meta.url),"utf8");
  assert.doesNotMatch(jsx,/\bfetch\s*\(|\bWebSocket\s*\(|\blocalStorage\b|\bsessionStorage\b/);
  assert.match(jsx,/NOT RUN/);
});
