import React,{useRef,useState} from "react";
import {parseTriBrainSnapshot,TRI_BRAIN_MAX_FILE_BYTES,triBrainReviewSummary} from "./tri-brain-snapshot.mjs";
import "./tri-brain-viewer.css";

const LANE_NAMES={
  WITNESS:"01 · WITNESS",
  WEAVER:"02 · WEAVER",
  STEWARD:"03 · STEWARD"
};
function SourceReferences({references=[]}){
  if(references.length===0)return <span>Local source record only, no exported external locator.</span>;
  return <ul className="tt3-refs">{references.map((ref,index)=>
    <li key={index}>
      {ref.kind==="github_immutable_commit"
        ? <span>GitHub snapshot: {ref.repository} · {ref.commit.slice(0,12)} · {ref.path}</span>
        : <span>Active vault note: {ref.vault_id} / {ref.path}</span>}
    </li>
  )}</ul>;
}
function WitnessLane({items}){
  return <div className="tt3-cards">{items.map(w=>
    <article className="tt3-card" key={w.id}>
      <div className="tt3-card-top">
        <strong>{w.statement}</strong><span className="tt3-subtle">{w.recorded_state}</span>
      </div>
      <p className="tt3-quote"><span aria-hidden="true">“</span>{w.citation.quote}<span aria-hidden="true">”</span></p>
      <dl className="tt3-facts">
        <div><dt>Claim</dt><dd>{w.id}</dd></div>
        <div><dt>Source</dt><dd>{w.citation.source_title}</dd></div>
        <div><dt>Line / offset</dt><dd>L{w.citation.line_start}{w.citation.line_end!==w.citation.line_start?("-"+w.citation.line_end):""} · +{w.citation.quote_offset}</dd></div>
        <div><dt>Observed</dt><dd>{w.source_observed_at} · {w.source_observation_age_days} days old</dd></div>
        <div><dt>Validity</dt><dd>{w.valid_time.status.replaceAll("_"," ")}</dd></div>
      </dl>
      <details className="tt3-detail"><summary>Provenance and recorded source digest</summary>
        <p className="tt3-mono">{w.citation.source_sha256}</p>
        <SourceReferences references={w.citation.references}/>
        <p className="tt3-muted">Source body is not included, so this screen cannot independently re-check its hash or quote offset.</p>
      </details>
      {w.warnings.length>0&&<div className="tt3-warning">
        <strong>Review warnings</strong><ul>{w.warnings.map((item,i)=><li key={i}>{item}</li>)}</ul>
      </div>}
    </article>
  )}</div>;
}
function WeaverLane({items,byClaim}){
  if(!items.length)return <p className="tt3-empty">No WEAVER relationships were selected for this snapshot.</p>;
  return <div className="tt3-cards">{items.map(r=>
    <article className="tt3-card" key={r.id}>
      <div className="tt3-card-top">
        <strong>Proposed: {r.relation_proposed}</strong>
        <span className="tt3-subtle">Review: {r.review_status.replaceAll("_"," ")}</span>
      </div>
      <div className="tt3-pair">
        <p><small>Claim A</small>{byClaim.get(r.left_claim)?.statement}</p>
        <p><small>Claim B</small>{byClaim.get(r.right_claim)?.statement}</p>
      </div>
      <p className="tt3-muted">Method: {r.method} · {r.id}</p>
      <p className="tt3-boundary">Relationship review is not a verification of either claim.</p>
    </article>)}</div>;
}
function StewardLane({items,byClaim}){
  if(!items.length)return <p className="tt3-empty">No STEWARD decisions were selected for this snapshot.</p>;
  return <div className="tt3-cards">{items.map(d=>
    <article className="tt3-card" key={d.id}>
      <div className="tt3-card-top">
        <strong>{d.title}</strong><span className="tt3-subtle">{d.status.toUpperCase()}</span>
      </div>
      <p>{d.rationale}</p>
      <p className="tt3-muted">Evidence recorded in WITNESS:</p>
      <ul>{d.evidence_claim_ids.map(id=><li key={id}>{byClaim.get(id)?.statement}</li>)}</ul>
      <dl className="tt3-facts">
        <div><dt>Local credentials checked</dt><dd>{d.credential_checked?"Recorded yes":"No / legacy"}</dd></div>
        <div><dt>Review attestation</dt><dd>{d.review_attestation_digest??"Not supplied"}</dd></div>
      </dl>
      <p className="tt3-boundary">Execution authorization: NONE. A reviewed decision is not a permission grant.</p>
    </article>)}</div>;
}

export function TriBrainSnapshotViewer({onOpenTrust=()=>{},onOpenProvenance=()=>{}}){
  const inputRef=useRef(null);
  const requestRef=useRef(0);
  const [state,setState]=useState({status:"empty",snapshot:null,error:"",filename:""});
  const [lane,setLane]=useState("WITNESS");
  const [copyNotice,setCopyNotice]=useState("");
  async function load(file){
    const request=++requestRef.current;
    setCopyNotice("");
    setState({status:"loading",snapshot:null,error:"",filename:""});
    if(!file)return;
    if(file.size>TRI_BRAIN_MAX_FILE_BYTES){
      setState({status:"error",snapshot:null,
        error:"File exceeds 256 KB. No data was imported.",filename:""});
      return;
    }
    try{
      const raw=await file.text();
      const snapshot=await parseTriBrainSnapshot(raw);
      if(request!==requestRef.current)return;
      setLane("WITNESS");
      setState({status:"ready",snapshot,error:"",filename:file.name});
    }catch(error){
      if(request!==requestRef.current)return;
      setState({status:"error",snapshot:null,
        error:error instanceof Error?error.message:"Could not inspect snapshot",
        filename:""});
    }
  }
  function clear(){
    ++requestRef.current;
    if(inputRef.current)inputRef.current.value="";
    setState({status:"empty",snapshot:null,error:"",filename:""});
    setLane("WITNESS");
    setCopyNotice("");
  }
  async function copySummary(){
    if(!state.snapshot){setCopyNotice("Select a valid local snapshot first.");return;}
    try{
      if(!navigator.clipboard?.writeText)throw Error("No clipboard API");
      await navigator.clipboard.writeText(triBrainReviewSummary(state.snapshot));
      setCopyNotice("Review-only counts copied. No claim text, job or permission was sent.");
    }catch{
      setCopyNotice("Clipboard unavailable. Nothing was copied or sent.");
    }
  }
  const data=state.snapshot;
  const byClaim=new Map((data?.lanes.WITNESS??[]).map(c=>[c.id,c]));
  return <section className="tt3-root" aria-label="Three-Brain Ledger read-only viewer">
    <header className="tt3-hero">
      <small>R38 / PHITRIBRAIN369 / LOCAL SNAPSHOT</small>
      <h3>Three-Brain Ledger</h3>
      <p>Import a Rung 4a JSON snapshot that you deliberately exported from PhiTriBrain369. All three lanes are read-only. Nothing is fetched, dispatched, approved, or sent to PhiBots.</p>
    </header>
    <div className="tt3-import">
      <label htmlFor="tt3-local-snapshot">Choose a local three-brain JSON snapshot</label>
      <input ref={inputRef} id="tt3-local-snapshot" type="file" accept=".json,application/json"
        onChange={event=>load(event.target.files?.[0]??null)}/>
      <p className="tt3-muted">Maximum 256 KB · Local browser memory only · Select non-sensitive project evidence</p>
      {state.status!=="empty"&&<button type="button" className="tt3-clear" onClick={clear}>
        Clear loaded evidence
      </button>}
    </div>
    <div role="status" aria-live="polite">
      {state.status==="loading"&&<p>Inspecting selected local file…</p>}
      {state.status==="error"&&<p className="tt3-error">{state.error}</p>}
    </div>
    {!data&&state.status!=="loading"&&<div className="tt3-placeholder">
      <strong>No trusted snapshot selected</strong>
      <p>The preview will show WITNESS claims, WEAVER suggestions and STEWARD decisions after strict shape and content-digest checks. A matching digest is not a digital signature or independent evidence verification.</p>
    </div>}
    {data&&<>
      <div className="tt3-ledger-head">
        <div><small>IMPORTED LOCALLY · NOT A LIVE CONNECTION</small>
          <strong>{data.scope} · {state.filename}</strong>
          <span>Created {data.as_of} · Consumer label: {data.consumer_label_not_authentication}</span>
        </div>
        <p>Content digest matches the included snapshot. Its source authenticity, original quote hashes, factual truth, and reviewer identities are <strong>not independently verified here</strong>.</p>
      </div>
      <div className="tt3-counts" aria-label="Three-brain snapshot record counts">
        {Object.entries(LANE_NAMES).map(([id,label])=>
          <button type="button" key={id} aria-pressed={lane===id}
            className={lane===id?"active":""} onClick={()=>setLane(id)}>
            <span>{label}</span><strong>{data.lanes[id].length}</strong>
          </button>)}
      </div>
      <div className="tt3-lane" aria-label={LANE_NAMES[lane]}>
        <header><h4>{LANE_NAMES[lane]}</h4>
          <p>{lane==="WITNESS"?"Exact source-attributed claims, not independently proven facts.":
            lane==="WEAVER"?"Suggested connections, not semantic truth or permissions.":
            "Evidence-linked decisions, not deployment or execution authority."}</p>
        </header>
        {lane==="WITNESS"&&<WitnessLane items={data.lanes.WITNESS}/>}
        {lane==="WEAVER"&&<WeaverLane items={data.lanes.WEAVER} byClaim={byClaim}/>}
        {lane==="STEWARD"&&<StewardLane items={data.lanes.STEWARD} byClaim={byClaim}/>}
      </div>
      <div className="tt3-next">
        <p>Unsigned snapshot: matching digest does not authenticate the source or verify facts.</p>
        <button type="button" onClick={copySummary}>Copy safe review summary</button>
      </div>
    </>}
    {copyNotice&&<p role="status" className="tt3-copy-notice">{copyNotice}</p>}
    <nav className="tt3-next" aria-label="Related evidence rooms">
      <button type="button" onClick={onOpenTrust}>R36 · Evidence &amp; Trust</button>
      <button type="button" onClick={onOpenProvenance}>R37 · Council Provenance</button>
    </nav>
  </section>;
}
