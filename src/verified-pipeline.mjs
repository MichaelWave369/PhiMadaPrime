// Φ Verified Pipeline Factory R1. Design contracts, never execution.
import {z} from "zod";

export const PIPELINE_KINDS=Object.freeze(["request","plan","evidence","verify","review","result"]);
export const STAGE_LABELS=Object.freeze({
  request:"Define mission",plan:"Plan work",evidence:"Gather evidence",
  verify:"Independent verification",review:"Human review",result:"Reviewable result"
});
export const MAX_PIPELINE_BYTES=65536;
const ident=z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const safeText=max=>z.string().trim().min(1).max(max).refine(
  x=>!/[\u0000-\u001f\u007f]/.test(x),"Control characters not allowed"
);
const position=z.strictObject({
  x:z.number().finite().min(-10000).max(10000),
  y:z.number().finite().min(-10000).max(10000)
});
const node=z.strictObject({id:ident,kind:z.enum(PIPELINE_KINDS),
  label:safeText(100),position});
const edge=z.strictObject({id:ident,source:ident,target:ident});
export const pipelineSchema=z.strictObject({
  schema_version:z.literal(1),
  document_kind:z.literal("PHI_VERIFIED_PIPELINE_DRAFT"),
  mode:z.literal("DESIGN_ONLY"),
  pipeline_id:ident,title:safeText(120),objective:safeText(350),
  nodes:z.array(node).min(2).max(16),edges:z.array(edge).max(30),
  execution:z.strictObject({
    status:z.literal("NOT_RUN"),enabled:z.literal(false),
    permissions:z.array(z.string()).length(0)
  })
});

export function pipelineTemplate(){
  const nodes=PIPELINE_KINDS.map((kind,i)=>({
    id:kind,kind,label:STAGE_LABELS[kind],
    position:{x:i*235,y:i%2===0?100:205}
  }));
  const edges=PIPELINE_KINDS.slice(1).map((kind,i)=>({
    id:"e-"+(i+1),source:PIPELINE_KINDS[i],target:kind
  }));
  return {
    schema_version:1,document_kind:"PHI_VERIFIED_PIPELINE_DRAFT",
    mode:"DESIGN_ONLY",pipeline_id:"btm-ci-review",
    title:"BTM CI review pipeline",
    objective:"Inspect actual repository evidence, propose a patch, independently verify real tests, then request human review.",
    nodes,edges,execution:{status:"NOT_RUN",enabled:false,permissions:[]}
  };
}

function validateGraph(value){
  const issues=[],nodes=value.nodes,edges=value.edges;
  const idSet=new Set(nodes.map(n=>n.id));
  if(idSet.size!==nodes.length)issues.push("Duplicate node IDs");
  if(new Set(edges.map(e=>e.id)).size!==edges.length)issues.push("Duplicate edge IDs");
  const start=nodes.filter(n=>n.kind==="request"),end=nodes.filter(n=>n.kind==="result");
  if(start.length!==1)issues.push("Exactly one request stage required");
  if(end.length!==1)issues.push("Exactly one result stage required");
  for(const kind of ["plan","evidence","verify","review"]){
    if(!nodes.some(n=>n.kind===kind))issues.push("Missing stage: "+kind);
  }
  const pairs=new Set(),adj=new Map(nodes.map(n=>[n.id,[]]));
  const indegree=new Map(nodes.map(n=>[n.id,0]));
  for(const item of edges){
    if(!idSet.has(item.source)||!idSet.has(item.target)){
      issues.push("Unknown edge endpoint: "+item.id);continue;
    }
    if(item.source===item.target)issues.push("Self-link: "+item.id);
    const key=item.source+"->"+item.target;
    if(pairs.has(key))issues.push("Duplicate connection: "+key);
    pairs.add(key);
    adj.get(item.source).push(item.target);
    indegree.set(item.target,indegree.get(item.target)+1);
  }
  if(issues.length)return issues;
  const queue=nodes.filter(n=>indegree.get(n.id)===0).map(n=>n.id);
  let walked=0;
  for(let i=0;i<queue.length;i++){
    walked++;
    for(const next of adj.get(queue[i])){
      indegree.set(next,indegree.get(next)-1);
      if(indegree.get(next)===0)queue.push(next);
    }
  }
  if(walked!==nodes.length)return ["Cycles forbidden in R1 pipeline design"];
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const seen=new Set(),reached=new Set();
  const todo=[[start[0].id,0]];
  let outputReached=false;
  while(todo.length){
    const [id,mask]=todo.pop(),key=id+":"+mask;
    if(seen.has(key))continue;
    seen.add(key);reached.add(id);
    const kind=byId.get(id).kind;
    let nextMask=mask;
    if(kind==="evidence")nextMask|=1;
    if(kind==="verify"){
      if(!(mask&1))issues.push("Verification before evidence");
      nextMask|=2;
    }
    if(kind==="review"){
      if(!(mask&2))issues.push("Human review before verification");
      nextMask|=4;
    }
    if(kind==="result"){
      outputReached=true;
      if(nextMask!==7)issues.push("Result route bypasses evidence, verification or human review");
    }else{
      if(!adj.get(id).length)issues.push("Dead-end node: "+id);
      for(const next of adj.get(id))todo.push([next,nextMask]);
    }
  }
  if(!outputReached)issues.push("No request-to-result path");
  if(reached.size!==nodes.length)issues.push("Some nodes unreachable from request");
  const rev=new Map(nodes.map(n=>[n.id,[]]));
  for(const item of edges)rev.get(item.target).push(item.source);
  const goesToEnd=new Set([end[0].id]),stack=[end[0].id];
  while(stack.length){
    const id=stack.pop();
    for(const p of rev.get(id)){
      if(!goesToEnd.has(p)){goesToEnd.add(p);stack.push(p);}
    }
  }
  if(goesToEnd.size!==nodes.length)issues.push("Not every node leads to result");
  return [...new Set(issues)];
}

export function inspectPipeline(value){
  const parsed=pipelineSchema.safeParse(value);
  if(!parsed.success)return {
    valid:false,state:"INVALID_SCHEMA",runStatus:"NOT_RUN",
    executionAuthorized:false,permissions:[],
    issues:parsed.error.issues.slice(0,25).map(i=>
      (i.path.join(".")||"document")+": "+i.message)
  };
  const issues=validateGraph(parsed.data);
  return {valid:issues.length===0,
    state:issues.length?"INVALID_GRAPH":"DESIGN_VALID_NOT_RUN",
    runStatus:"NOT_RUN",executionAuthorized:false,permissions:[],issues};
}

export function parsePipelineText(raw){
  if(typeof raw!=="string"||raw.length===0||
    new TextEncoder().encode(raw).byteLength>MAX_PIPELINE_BYTES)
    throw Error("Local JSON must be at most 64 KiB");
  let parsed;
  try{parsed=JSON.parse(raw);}catch{throw Error("Invalid pipeline JSON");}
  const check=pipelineSchema.safeParse(parsed);
  if(!check.success)throw Error("Invalid pipeline schema or authority boundary");
  if(validateGraph(check.data).length)throw Error("Pipeline topology invalid");
  return check.data;
}

export function serializePipeline(doc){
  if(!inspectPipeline(doc).valid)throw Error("Invalid design cannot be exported");
  return JSON.stringify(pipelineSchema.parse(doc),null,2)+"\n";
}
