import React,{useRef,useState} from "react";
import {
  INFERENCE_MAX_FILE_BYTES,inspectInferenceFiles,inferenceSummary
} from "./inference-observatory.mjs";
import "./inference-observatory.css";

const gib=bytes=>bytes===null?"UNKNOWN":(bytes/1024**3).toFixed(2)+" GiB";
const ms=value=>Number.isFinite(value)?value.toFixed(1)+" ms":"NOT REPORTED";
const tps=value=>value===null?"NOT REPORTED":value.toFixed(1)+" tok/s (end-to-end)";

export function InferenceObservatory(){
  const inputRef=useRef(null);
  const sequence=useRef(0);
  const [view,setView]=useState({state:"empty",report:null,error:"",names:[]});
  const [notice,setNotice]=useState("");
  async function load(files){
    const generation=++sequence.current;
    setNotice("");
    if(!files.length){
      setView({state:"empty",report:null,error:"",names:[]});
      return;
    }
    setView({state:"loading",report:null,error:"",names:[]});
    try{
      if(files.length>10||files.some(file=>file.size<2||file.size>INFERENCE_MAX_FILE_BYTES))
        throw Error("Select up to 10 nonempty JSON files, each at most 1 MiB.");
      const inputs=await Promise.all(files.map(async file=>({
        name:file.name,text:await file.text()
      })));
      const report=await inspectInferenceFiles(inputs);
      if(generation!==sequence.current)return;
      setView({state:"ready",report,error:"",names:files.map(x=>x.name)});
    }catch(error){
      if(generation!==sequence.current)return;
      setView({state:"error",report:null,
        error:error instanceof Error?error.message:"Could not inspect selected evidence",
        names:[]});
    }
  }
  function clear(){
    ++sequence.current;
    if(inputRef.current)inputRef.current.value="";
    setView({state:"empty",report:null,error:"",names:[]});
    setNotice("");
  }
  async function copySummary(){
    if(!view.report)return;
    try{
      if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(inferenceSummary(view.report));
      setNotice("Review-only metadata copied. No prompts, paths, receipts or commands sent.");
    }catch{
      setNotice("Clipboard unavailable. No evidence sent.");
    }
  }
  const report=view.report;
  return <section className="inf-root" aria-label="Inference Observatory read-only evidence room">
    <header className="inf-hero">
      <small>ΦMADA PRIME / R39 / Φ INFERENCE FABRIC R16</small>
      <h3>Inference Observatory</h3>
      <p>PhiStream hardware snapshots + PhiServe benchmark receipts + R15 capacity advice.
        Review imported measurements before planning model placement. Nothing here connects
        to a live model, reads hardware automatically, grants permissions, or sends a request.</p>
      <strong className="inf-boundary">LOCAL FILE REVIEW · NOT A LIVE GPU DASHBOARD · NO DISPATCH</strong>
    </header>
    <div className="inf-import">
      <label htmlFor="inf-evidence-input">Import R15 advisory and, optionally, its original source JSON files together</label>
      <input ref={inputRef} id="inf-evidence-input" type="file" multiple
        accept=".json,application/json"
        onChange={event=>load(Array.from(event.target.files||[]))}/>
      <p>Choose exactly one R15 advisory. Optionally select the PhiStream hardware
        snapshot and its 1–8 PhiServe R13 benchmark receipts in the same file picker.
        Each JSON is limited to 1 MiB. Original model weights are never imported.</p>
      {view.state!=="empty"&&<button type="button" className="inf-clear" onClick={clear}>
        Clear loaded evidence from this view
      </button>}
    </div>
    <div role="status" aria-live="polite">
      {view.state==="loading"&&<p className="inf-soft">Inspecting selected local files…</p>}
      {view.state==="error"&&<p className="inf-error">{view.error}</p>}
    </div>
    {!report&&view.state!=="loading"&&<div className="inf-empty">
      <strong>No observed hardware measurements imported</strong>
      <p>Import existing local R15 receipts to inspect measured configurations. This
        page does not contain sample benchmarks pretending to be your RTX hardware.</p>
    </div>}
    {report&&<>
      <section className="inf-review" aria-label="Evidence review status">
        <div className="inf-review-top">
          <div>
            <small>REPORTED CAPACITY CLASSIFICATION</small>
            <h4>{report.classification.replaceAll("_"," ")}</h4>
            <span>Evaluation: {report.evaluatedUtc}</span>
          </div>
          <div className={report.freshness==="RECENT_AT_VIEW"?"inf-chip":"inf-chip inf-hold"}>
            {report.freshness.replaceAll("_"," ")}
          </div>
        </div>
        <p><strong>Local source binding:</strong> {report.matchedSources}/{report.expectedSources}
          {" "}source files matched · {report.provenance.replaceAll("_"," ")}</p>
        <p>{report.warning}</p>
        <p className="inf-soft">This freshness indicator is computed when imported.
          An earlier REVIEW_REQUIRED result is not a current hardware clearance.</p>
      </section>
      <section className="inf-metrics" aria-label="Reported capacity observations">
        <article><small>MODEL ALIAS</small><strong>{report.alias}</strong>
          <span>{gib(report.modelBytes)} GGUF file</span></article>
        <article><small>AVAILABLE HOST RAM</small><strong>{gib(report.ramAvailableBytes)}</strong>
          <span>After selected reserve: {gib(report.ramBudgetBytes)}</span></article>
        <article><small>FREE CUDA MEMORY</small><strong>{gib(report.gpuFreeBytes)}</strong>
          <span>After selected reserve: {gib(report.gpuBudgetBytes)}</span></article>
        <article><small>FULL FILE-SIZE FLOORS</small>
          <strong>CPU: {report.cpuFileFloor?"WITHIN FLOOR":"OUTSIDE FLOOR"}</strong>
          <span>GPU: {report.gpuFileFloor===null?"UNKNOWN":
            report.gpuFileFloor?"WITHIN FLOOR":"OUTSIDE FLOOR"}</span></article>
      </section>
      <section className="inf-profiles" aria-label="Imported benchmark profiles">
        <header><h4>Measured configurations</h4>
          <p>R13 reports end-to-end request timings, not decode-only speed or independently witnessed CUDA activity.</p></header>
        <div className="inf-table-scroll">
          <table>
            <thead><tr><th scope="col">GPU layers requested</th><th scope="col">p50 wall</th>
              <th scope="col">p95 wall</th><th scope="col">Startup</th>
              <th scope="col">Median throughput</th><th scope="col">Source</th></tr></thead>
            <tbody>{report.profiles.map(p=><tr key={p.gpuLayers}>
              <th scope="row">{p.gpuLayers}</th>
              <td>{ms(p.p50)}</td><td>{ms(p.p95)}</td><td>{ms(p.startupMs)}</td>
              <td>{tps(p.tps)}<small>{p.tokensObserved} trials with reported tokens</small></td>
              <td>{p.sourceMatched?"Local bytes matched":"Not supplied"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="inf-soft">The R15 output can compare different requested offload settings,
          but matching OS families and file hashes do not establish identical hardware,
          thermal conditions, model quality, actual memory residency, or hardware identity.</p>
      </section>
      <div className="inf-review inf-footer">
        <strong>Review boundary</strong>
        <p>Producer authenticated: NO · CUDA execution verified: NO · Model fit verified: NO ·
          Quality evaluated: NO · Execution authorized: NO</p>
        <p>Hardware source bytes: {report.snapshotMatched?"Locally matched":"Not supplied"}.
          No data is automatically fetched, stored or uploaded by this viewer.</p>
        <button type="button" className="inf-copy" onClick={copySummary}>
          Copy safe, review-only summary
        </button>
      </div>
    </>}
    {notice&&<p role="status" className="inf-notice">{notice}</p>}
  </section>;
}
