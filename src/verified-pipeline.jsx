import React,{useCallback,useMemo,useRef,useState} from "react";
import {ReactFlow,Background,Controls,MiniMap,Handle,Position,addEdge,
  useNodesState,useEdgesState} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  PIPELINE_KINDS,STAGE_LABELS,MAX_PIPELINE_BYTES,
  pipelineTemplate,inspectPipeline,parsePipelineText,serializePipeline
} from "./verified-pipeline.mjs";
import "./verified-pipeline.css";
import {SyntheticGateLab} from "./verified-pipeline-simulator.jsx";
import {PublicCiEvidenceBridge} from "./verified-pipeline-live-evidence.jsx";
import {LocalReceiptBridge} from "./verified-pipeline-local-receipts.jsx";

function StageNode({data,selected}){
  return <div className={"vp-stage vp-"+data.kind+(selected?" vp-selected":"")}>
    {data.kind!=="request"&&<Handle type="target" position={Position.Left}/>}
    <small>{data.kind.toUpperCase()}</small>
    <strong>{data.label}</strong>
    <span>{data.kind==="verify"?"Actual test receipts required":
      data.kind==="review"?"Human decision, no execution grant":
      data.kind==="result"?"Unverified until runtime evidence exists":
      "Design stage · NOT RUN"}</span>
    {data.kind!=="result"&&<Handle type="source" position={Position.Right}/>}
  </div>;
}
const TYPES={stage:StageNode};
const toVisual=doc=>({
  nodes:doc.nodes.map(n=>({id:n.id,type:"stage",position:n.position,
    data:{kind:n.kind,label:n.label}})),
  edges:doc.edges.map(e=>({...e,type:"smoothstep",animated:false}))
});
const fromVisual=(title,objective,pipelineId,nodes,edges)=>({
  schema_version:1,document_kind:"PHI_VERIFIED_PIPELINE_DRAFT",
  mode:"DESIGN_ONLY",pipeline_id:pipelineId,title,objective,
  nodes:nodes.map(n=>({id:n.id,kind:n.data.kind,label:n.data.label,
    position:{x:Math.round(n.position.x),y:Math.round(n.position.y)}})),
  edges:edges.map(e=>({id:e.id,source:e.source,target:e.target})),
  execution:{status:"NOT_RUN",enabled:false,permissions:[]}
});

export function VerifiedPipelineFactory({rows=[],signals={},signalsBusy={},onInspectRepo=()=>{}}){
  const initial=useMemo(()=>pipelineTemplate(),[]);
  const graph=useMemo(()=>toVisual(initial),[initial]);
  const [nodes,setNodes,onNodesChange]=useNodesState(graph.nodes);
  const [edges,setEdges,onEdgesChange]=useEdgesState(graph.edges);
  const [title,setTitle]=useState(initial.title);
  const [objective,setObjective]=useState(initial.objective);
  const [pipelineId,setPipelineId]=useState(initial.pipeline_id);
  const [kind,setKind]=useState("evidence");
  const [selectedId,setSelectedId]=useState("");
  const [notice,setNotice]=useState("");
  const count=useRef(50);
  const inputRef=useRef(null);
  const candidate=useMemo(()=>fromVisual(title,objective,pipelineId,nodes,edges),
    [title,objective,pipelineId,nodes,edges]);
  const report=useMemo(()=>inspectPipeline(candidate),[candidate]);
  const selected=nodes.find(n=>n.id===selectedId);

  const onConnect=useCallback(connection=>{
    if(!connection.source||!connection.target)return;
    setEdges(current=>{
      if(current.some(e=>e.source===connection.source&&e.target===connection.target))
        return current;
      let id;
      do{id="e-"+(++count.current);}while(current.some(e=>e.id===id));
      return addEdge({...connection,id,type:"smoothstep",animated:false},current);
    });
  },[setEdges]);
  function addStage(){
    if(nodes.length>=16){setNotice("R1 supports at most 16 stages.");return;}
    let id;
    do{id="stage-"+(++count.current);}while(nodes.some(n=>n.id===id));
    setNodes(current=>[...current,{id,type:"stage",
      position:{x:100+(current.length%3)*260,y:330+Math.floor(current.length/3)*155},
      data:{kind,label:STAGE_LABELS[kind]}}]);
    setSelectedId(id);setNotice("Stage added. Connect and check every path.");
  }
  function removeStage(){
    if(!selectedId)return;
    setNodes(old=>old.filter(n=>n.id!==selectedId));
    setEdges(old=>old.filter(e=>e.source!==selectedId&&e.target!==selectedId));
    setSelectedId("");setNotice("Stage removed. Check graph validity.");
  }
  function reset(){
    const doc=pipelineTemplate(),v=toVisual(doc);
    setNodes(v.nodes);setEdges(v.edges);setTitle(doc.title);
    setObjective(doc.objective);setPipelineId(doc.pipeline_id);
    setSelectedId("");setNotice("Restored example (still NOT RUN).");
  }
  async function importFile(file){
    if(!file)return;
    try{
      if(file.size===0||file.size>MAX_PIPELINE_BYTES)throw Error("File exceeds 64 KiB.");
      const doc=parsePipelineText(await file.text()),v=toVisual(doc);
      setNodes(v.nodes);setEdges(v.edges);setTitle(doc.title);
      setObjective(doc.objective);setPipelineId(doc.pipeline_id);
      setSelectedId("");setNotice("Local design imported. NOT RUN, NOT VERIFIED.");
    }catch(e){
      setNotice("Import rejected: "+(e instanceof Error?e.message:"invalid document"));
    }finally{if(inputRef.current)inputRef.current.value="";}
  }
  function exportJson(){
    try{
      const text=serializePipeline(candidate);
      const blob=new Blob([text],{type:"application/json"});
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="phi-pipeline-design.json";
      document.body.appendChild(a);a.click();a.remove();
      URL.revokeObjectURL(url);
      setNotice("Design-only JSON saved. No tests or agents ran.");
    }catch{setNotice("Export blocked. Resolve all graph and schema issues.");}
  }

  return <section className="vp-factory" aria-label="Verified Pipeline Factory designer">
    <header className="vp-heading">
      <div><small>ΦMADA PRIME · VERIFIED PIPELINE FACTORY · R39–R45</small>
        <h3>Architect workflows. Require evidence.</h3>
        <p>Drag, connect, inspect and export. No models, tests, approvals or executions.</p>
      </div>
      <strong className={report.valid?"vp-ready":"vp-held"}>
        {report.valid?"DESIGN VALID · NOT RUN":"DRAFT HELD · NOT RUN"}
      </strong>
    </header>
    <div className="vp-meta">
      <label>Pipeline ID<input value={pipelineId} maxLength={64}
        onChange={e=>setPipelineId(e.target.value)}/></label>
      <label>Title<input value={title} maxLength={120}
        onChange={e=>setTitle(e.target.value)}/></label>
      <label>Objective<textarea value={objective} maxLength={350} rows={2}
        onChange={e=>setObjective(e.target.value)}/></label>
    </div>
    <div className="vp-controls">
      <label>New stage<select value={kind} onChange={e=>setKind(e.target.value)}>
        {PIPELINE_KINDS.map(k=><option key={k} value={k}>{STAGE_LABELS[k]}</option>)}
      </select></label>
      <button type="button" onClick={addStage}>Add stage</button>
      <button type="button" onClick={reset}>Reset example</button>
      <label className="vp-import">Import local JSON
        <input ref={inputRef} type="file" accept=".json,application/json"
          onChange={e=>importFile(e.target.files?.[0])}/></label>
      <button type="button" disabled={!report.valid} onClick={exportJson}>
        Export design JSON
      </button>
    </div>
    <div className="vp-layout">
      <div className="vp-graph" role="group" aria-label="Editable directed pipeline graph">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={TYPES}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onNodeClick={(_,node)=>setSelectedId(node.id)}
          onSelectionChange={({nodes:chosen})=>setSelectedId(chosen[0]?.id||"")}
          onPaneClick={()=>setSelectedId("")} fitView minZoom={0.2} maxZoom={1.8}
          deleteKeyCode={["Backspace","Delete"]} colorMode="dark">
          <Background color="#456780" gap={22}/>
          <Controls showInteractive={false}/>
          <MiniMap pannable zoomable nodeColor="#56aabc"/>
        </ReactFlow>
      </div>
      <aside className="vp-inspector" aria-label="Stage and graph inspector">
        <h4>Stage inspector</h4>
        {selected?<div className="vp-edit">
          <p>Selected {selected.data.kind}</p>
          <label>Label<input value={selected.data.label} maxLength={100}
            onChange={e=>setNodes(old=>old.map(n=>n.id===selectedId?
              {...n,data:{...n.data,label:e.target.value}}:n))}/></label>
          <button type="button" onClick={removeStage}>Remove selected stage</button>
        </div>:<p>Select a stage to edit it. Drag nodes and link their handles to build routes.</p>}
        <h4>Gate inspection</h4>
        <strong className="vp-state">{report.state.replaceAll("_"," ")}</strong>
        {report.issues.length?<ul>{report.issues.slice(0,12).map((x,i)=><li key={i}>{x}</li>)}</ul>:
          <p>Every result route includes evidence, verification and human review in order.</p>}
        <div className="vp-denied">
          <strong>Execution: NOT RUN</strong><span>Test receipts: NONE</span>
          <span>Verified claims: NONE</span><span>Permissions: NONE</span>
        </div>
      </aside>
    </div>
    <SyntheticGateLab design={candidate}/>
    <PublicCiEvidenceBridge design={candidate} rows={rows} signals={signals}
      signalsBusy={signalsBusy} onInspectRepo={onInspectRepo}/>
    <LocalReceiptBridge/>
    {notice&&<p role="status" className="vp-notice">{notice}</p>}
    <p className="vp-note">Diagram validity, simulated gate acceptance, and public CI observations are distinct. None alone proves test commands ran or grants approval. No runtime is connected.</p>
  </section>;
}
