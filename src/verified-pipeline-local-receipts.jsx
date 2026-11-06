import React,{useRef,useState} from "react";
import {parseTriBrainSnapshot,TRI_BRAIN_MAX_FILE_BYTES} from "./tri-brain-snapshot.mjs";
import {GMED_MAX_BYTES,inspectGmedLocalReceipt,correlateGmedWithWitness}
  from "./verified-pipeline-local-receipts.mjs";
import "./verified-pipeline-local-receipts.css";

/** Explicit local file comparison; no API calls, execution, or persistence. */
export function LocalReceiptBridge(){
  const gmedRef=useRef(null),witnessRef=useRef(null),sequence=useRef(0);
  const [gmed,setGmed]=useState(null),[witness,setWitness]=useState(null);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const correlation=correlateGmedWithWitness(gmed?.value,witness?.value);
  async function loadGmed(file){
    const attempt=++sequence.current;
    setGmed(null);setError("");setNotice("");
    if(!file)return;
    try {
      if(file.size<1||file.size>GMED_MAX_BYTES)throw Error("GMED receipt exceeds 256 KiB or is empty");
      const value=inspectGmedLocalReceipt(await file.text());
      if(attempt!==sequence.current)return;
      setGmed({filename:file.name,value});
      setNotice("GMED report structure and classifications checked locally; producer not authenticated.");
    }catch(e){
      if(attempt===sequence.current)setError(e instanceof Error?e.message:"Invalid GMED report");
    }finally{
      if(gmedRef.current)gmedRef.current.value="";
    }
  }
  async function loadWitness(file){
    const attempt=++sequence.current;
    setWitness(null);setError("");setNotice("");
    if(!file)return;
    try {
      if(file.size<1||file.size>TRI_BRAIN_MAX_FILE_BYTES)
        throw Error("WITNESS export exceeds 256 KiB or is empty");
      const value=await parseTriBrainSnapshot(await file.text());
      if(attempt!==sequence.current)return;
      setWitness({filename:file.name,value});
      setNotice("Three-brain snapshot checksum checked locally; original sources not replayed.");
    }catch(e){
      if(attempt===sequence.current)setError(e instanceof Error?e.message:"Invalid WITNESS export");
    }finally{
      if(witnessRef.current)witnessRef.current.value="";
    }
  }
  function clear(){
    ++sequence.current;
    if(gmedRef.current)gmedRef.current.value="";
    if(witnessRef.current)witnessRef.current.value="";
    setGmed(null);setWitness(null);setError("");setNotice("Cleared local receipt copies.");
  }
  return <section className="vpl-root" aria-label="Local GMED and WITNESS receipt comparison">
    <header className="vpl-head">
      <div><small>R3 PHASE 2 / LOCAL FILES / UNSIGNED</small>
        <h4>GMED × WITNESS receipt desk</h4>
        <p>Compare original GMED v1 PR reports with PhiTriBrain369 R4a exports.
          Strict structure checks, never a new trust authority.</p>
      </div>
      <span>READ ONLY · NO APPROVAL</span>
    </header>
    <div className="vpl-loaders">
      <label>GMED report JSON
        <input ref={gmedRef} type="file" accept=".json,application/json"
          onChange={e=>loadGmed(e.target.files?.[0])}/>
        <small>Export a report using GMED's public inspector or CLI. Unsigned local text.</small>
      </label>
      <label>PhiTriBrain369 R4a JSON
        <input ref={witnessRef} type="file" accept=".json,application/json"
          onChange={e=>loadWitness(e.target.files?.[0])}/>
        <small>Export an explicitly allowlisted non-sensitive WITNESS snapshot.</small>
      </label>
      <button type="button" onClick={clear}>Clear both imports</button>
    </div>
    {error&&<p className="vpl-error" role="alert">Import refused: {error}</p>}
    {notice&&<p className="vpl-notice" role="status">{notice}</p>}
    <div className="vpl-cards">
      <article>
        <h5>GMED local receipt</h5>
        {gmed?<dl>
          <div><dt>File</dt><dd>{gmed.filename}</dd></div>
          <div><dt>Reported PR</dt><dd>{gmed.value.reported_repository} #{gmed.value.reported_pr}</dd></div>
          <div><dt>Reported status</dt><dd>{gmed.value.reported_state}</dd></div>
          <div><dt>Reported merge SHA</dt><dd><code>{gmed.value.reported_sha||"NONE"}</code></dd></div>
          <div><dt>Sampled rows / reported success</dt>
            <dd>{gmed.value.reported_signals} / {gmed.value.reported_successes}</dd></div>
          <div><dt>Import check</dt><dd>{gmed.value.state.replaceAll("_"," ")}</dd></div>
          <div><dt>Timestamp</dt><dd>{gmed.value.observed_at}</dd></div>
        </dl>:<p>No GMED report imported.</p>}
        <p className="vpl-caution">Row counts and verdict can be internally consistent even in a
          completely fabricated report. This is not a live GMED verification.</p>
      </article>
      <article>
        <h5>PhiTriBrain369 local snapshot</h5>
        {witness?<dl>
          <div><dt>File</dt><dd>{witness.filename}</dd></div>
          <div><dt>Scope</dt><dd>{witness.value.scope}</dd></div>
          <div><dt>WITNESS / WEAVER / STEWARD</dt>
            <dd>{witness.value.lanes.WITNESS.length} /
              {witness.value.lanes.WEAVER.length} /
              {witness.value.lanes.STEWARD.length}</dd></div>
          <div><dt>Exported at</dt><dd>{witness.value.as_of}</dd></div>
          <div><dt>Content digest</dt><dd><code>{witness.value.content_sha256}</code></dd></div>
        </dl>:<p>No three-brain snapshot imported.</p>}
        <p className="vpl-caution">Matching content SHA-256 detects accidental changes;
          it does not authenticate the exporter or re-read original source bodies.</p>
      </article>
    </div>
    <div className="vpl-alignment">
      <h5>Optional commit-reference alignment</h5>
      <strong>{correlation.state.replaceAll("_"," ")}</strong>
      <p>{correlation.matches} explicitly selected WITNESS claims contain a
        GitHub reference whose repository and commit SHA text match the
        GMED receipt's reported merge commit.</p>
      {correlation.claim_ids.length>0&&<p>Matching claim IDs:
        {" "+correlation.claim_ids.join(", ")}</p>}
      <p className="vpl-caution">{correlation.warning}</p>
    </div>
    <p className="vpl-boundary">No network request, model inference, source replay,
      signed GMED provenance, CI test execution, GMED Ouroboros second opinion,
      permission grant or automatic cross-room synchronization is performed.
      Open the separate public CI desk for on-demand live observation.</p>
  </section>;
}
