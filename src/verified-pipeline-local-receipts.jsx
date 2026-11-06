import React,{useRef,useState} from "react";
import {parseTriBrainSnapshot,TRI_BRAIN_MAX_FILE_BYTES} from "./tri-brain-snapshot.mjs";
import {GMED_MAX_BYTES,inspectGmedLocalReceipt,correlateGmedWithWitness}
  from "./verified-pipeline-local-receipts.mjs";
import "./verified-pipeline-local-receipts.css";
import {reobserveGmedReceipt} from "./verified-pipeline-second-opinion.mjs";

/** Explicit local file comparison; no API calls, execution, or persistence. */
export function LocalReceiptBridge(){
  const gmedRef=useRef(null),witnessRef=useRef(null);
  const gmedSequence=useRef(0),witnessSequence=useRef(0),recheckSequence=useRef(0);
  const [gmed,setGmed]=useState(null),[witness,setWitness]=useState(null);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [second,setSecond]=useState(null),[checking,setChecking]=useState(false);
  const correlation=correlateGmedWithWitness(gmed?.value,witness?.value);
  async function loadGmed(file){
    const attempt=++gmedSequence.current;
    ++recheckSequence.current;
    setSecond(null);setChecking(false);
    setGmed(null);setError("");setNotice("");
    if(!file)return;
    try {
      if(file.size<1||file.size>GMED_MAX_BYTES)throw Error("GMED receipt exceeds 256 KiB or is empty");
      const raw=await file.text();
      const value=inspectGmedLocalReceipt(raw);
      if(attempt!==gmedSequence.current)return;
      setGmed({filename:file.name,value,raw});
      setNotice("GMED report structure and classifications checked locally; producer not authenticated.");
    }catch(e){
      if(attempt===gmedSequence.current)setError(e instanceof Error?e.message:"Invalid GMED report");
    }finally{
      if(gmedRef.current)gmedRef.current.value="";
    }
  }
  async function loadWitness(file){
    const attempt=++witnessSequence.current;
    setWitness(null);setError("");setNotice("");
    if(!file)return;
    try {
      if(file.size<1||file.size>TRI_BRAIN_MAX_FILE_BYTES)
        throw Error("WITNESS export exceeds 256 KiB or is empty");
      const value=await parseTriBrainSnapshot(await file.text());
      if(attempt!==witnessSequence.current)return;
      setWitness({filename:file.name,value});
      setNotice("Three-brain snapshot checksum checked locally; original sources not replayed.");
    }catch(e){
      if(attempt===witnessSequence.current)setError(e instanceof Error?e.message:"Invalid WITNESS export");
    }finally{
      if(witnessRef.current)witnessRef.current.value="";
    }
  }
  async function recheck(){
    if(!gmed?.raw)return;
    const request=++recheckSequence.current;
    const selected=gmedSequence.current;
    setSecond(null);setChecking(true);setError("");
    try {
      // Explicit user action is the only path to the public GitHub GETs.
      const result=await reobserveGmedReceipt(gmed.raw);
      if(request!==recheckSequence.current||selected!==gmedSequence.current)return;
      setSecond(result);
    }catch(e){
      if(request===recheckSequence.current&&selected===gmedSequence.current)
        setError(e instanceof Error?e.message:"GitHub re-observation unavailable");
    }finally{
      if(request===recheckSequence.current&&selected===gmedSequence.current)
        setChecking(false);
    }
  }
  function clear(){
    ++gmedSequence.current;
    ++witnessSequence.current;
    ++recheckSequence.current;
    if(gmedRef.current)gmedRef.current.value="";
    if(witnessRef.current)witnessRef.current.value="";
    setGmed(null);setWitness(null);setSecond(null);setChecking(false);
    setError("");setNotice("Cleared local receipt copies.");
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
    <section className="vpl-second" aria-label="Live independent GMED second opinion">
      <div className="vpl-second-head">
        <div>
          <h5>GMED public GitHub second opinion</h5>
          <p>The first receipt is unsigned. An explicit second observation compares
            the public merged PR, exact SHA, and complete bounded signal list.
            Both observations still use GitHub's public API.</p>
        </div>
        <button type="button" onClick={recheck} disabled={!gmed||checking}>
          {checking?"Rechecking public GitHub…":"Recheck public GitHub now"}
        </button>
      </div>
      {!second&&!checking&&<p className="vpl-empty">
        No live second opinion has been requested for this imported GMED receipt.
        Importing a file alone never contacts GitHub.
      </p>}
      {checking&&<p role="status">Reading public PR and observed merge-commit
        checks on demand. No changes or deployments are performed.</p>}
      {second&&<div className="vpl-second-report" role="status">
        <strong>{second.state.replaceAll("_"," ")}</strong>
        <dl>
          <div><dt>Imported GMED verdict</dt><dd>{second.imported_state}</dd></div>
          <div><dt>Fresh public GitHub verdict</dt><dd>{second.github_observed_state||"UNAVAILABLE"}</dd></div>
          <div><dt>Imported commit</dt><dd><code>{second.imported_sha||"NONE"}</code></dd></div>
          <div><dt>Fresh observed merge SHA</dt><dd><code>{second.github_observed_merge_sha||"UNAVAILABLE"}</code></dd></div>
          <div><dt>Observed signal count</dt><dd>{second.github_observed_signal_count??"UNAVAILABLE"}</dd></div>
          <div><dt>Re-observed at</dt><dd>{second.reobserved_at||"NOT COMPLETED"}</dd></div>
          <div><dt>Matching signal multiset</dt>
            <dd>{second.checks?.same_signal_multiset===true?"YES": "NO / NOT CHECKED"}</dd></div>
          <div><dt>Original imported receipt stale</dt><dd>{second.imported_stale?"YES":"NO"}</dd></div>
          <div><dt>Signed GMED producer identity</dt><dd>NOT AUTHENTICATED</dd></div>
          <div><dt>Required tests replayed</dt><dd>NO</dd></div>
          <div><dt>Merge authority</dt><dd>NONE</dd></div>
        </dl>
        {second.error&&<p className="vpl-error">{second.error}</p>}
        <p className="vpl-caution">{second.warning}</p>
      </div>}
    </section>
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
    <p className="vpl-boundary">File imports and WITNESS reference comparison are local.
      Only the explicit second-opinion button issues bounded read-only public
      GitHub requests. This is a fresh observation through a separate verifier
      implementation, not an independent provider or signed provenance.
      No model inference, test execution, original source replay, permission grant,
      automatic cross-room synchronization, or merge action occurs.
      The separate public HEAD desk remains available for current-branch checks.</p>
  </section>;
}
