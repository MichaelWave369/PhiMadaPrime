import React,{useState} from "react";
import {
  inspectedPublicHead,inspectLiveCiObservation
} from "./verified-pipeline-live-evidence.mjs";
import "./verified-pipeline-live-evidence.css";

/** User-initiated read-only public GitHub CI observation, not test verification. */
export function PublicCiEvidenceBridge({
  design,rows=[],signals={},signalsBusy={},onInspectRepo=()=>{}
}){
  const [selectedId,setSelectedId]=useState("");
  const [pinned,setPinned]=useState(null);
  const candidates=rows.filter(r=>r&&!r.exampleOnly&&
    Number.isSafeInteger(r.id)&&r.id>0&&typeof r.full_name==="string");
  const repo=candidates.find(r=>String(r.id)===selectedId)||null;
  const signal=repo?signals[repo.id]:null;
  const available=repo?inspectedPublicHead(repo,signal):null;
  const designSignature=JSON.stringify(design);
  const bindingCurrent=Boolean(repo&&pinned?.repository_id===repo.id&&
    pinned?.design_signature===designSignature);
  const evidence=repo&&pinned&&bindingCurrent?
    inspectLiveCiObservation(design,repo,signal,pinned.head_sha):null;

  function selectRepo(next){
    setSelectedId(next);setPinned(null);
  }
  function pin(){
    if(!repo||!available)return;
    setPinned({
      repository_id:repo.id,
      head_sha:available.head_sha,
      design_signature:designSignature
    });
  }
  return <section className="vpr-bridge" aria-label="Live public GitHub evidence observation">
    <header className="vpr-heading">
      <div><small>R3 / PUBLIC GITHUB / READ ONLY</small>
        <h4>Real Evidence Bridge · Phase 1</h4>
        <p>Inspect actual public GitHub HEAD and recent workflow status.
          No synthetic receipts enter this room.</p>
      </div>
      <strong>OBSERVATION ≠ VERIFICATION</strong>
    </header>
    <div className="vpr-controls">
      <label>Repository in public fleet catalog
        <select value={selectedId} onChange={e=>selectRepo(e.target.value)}>
          <option value="">Choose a public repository</option>
          {candidates.map(item=><option key={item.id} value={String(item.id)}>
            {item.name}
          </option>)}
        </select>
      </label>
      <button type="button" disabled={!repo||Boolean(signalsBusy[repo?.id])}
        onClick={()=>repo&&onInspectRepo(repo.id)}>
        {repo&&signalsBusy[repo.id]?"Inspecting…":"Inspect public HEAD & CI"}
      </button>
      <button type="button" onClick={pin}
        disabled={!repo||!available}>Pin observed HEAD</button>
      <button type="button" onClick={()=>setPinned(null)} disabled={!pinned}>
        Clear pin
      </button>
    </div>
    {!repo&&<p className="vpr-empty">Choose a real catalog entry. This room
      does not inspect private repositories or use imported synthetic fixtures.</p>}
    {repo&&<div className="vpr-data">
      <div className="vpr-rows">
        <div><small>Selected repository</small><strong>{repo.full_name}</strong></div>
        <div><small>Live observation</small><strong>{available?
          "Fresh in-memory GitHub observation":"Not available or stale"}</strong></div>
        <div><small>Branch</small><code>{available?.default_branch||"UNKNOWN"}</code></div>
        <div><small>Observed HEAD</small><code>{available?.head_sha||"UNKNOWN"}</code></div>
        <div><small>Pin</small><code>{pinned?.head_sha||"NOT PINNED"}</code></div>
        <div><small>Sampled CI classification</small><strong>{available?.ci_state||
          "NOT OBSERVED"}</strong></div>
        <div><small>Observed at</small><span>{available?.observed_at||"UNKNOWN"}</span></div>
      </div>
      {!pinned&&<p className="vpr-empty">
        Inspect the public repository, then deliberately pin the observed
        commit before reviewing exact-HEAD CI status.
      </p>}
      {pinned&&!bindingCurrent&&<p className="vpr-warning">
        Repository selection or pipeline design changed.
        Re-pin a fresh HEAD before evaluating evidence.
      </p>}
      {evidence&&<div className="vpr-report" role="status">
        <div><small>Read-only observation outcome</small>
          <strong>{evidence.state.replaceAll("_"," ")}</strong></div>
        <p>{evidence.ci_message||"No further CI details at this observed HEAD."}</p>
        <dl>
          <div><dt>Exact pinned SHA</dt><dd><code>{evidence.expected_head}</code></dd></div>
          <div><dt>Observation time</dt><dd>{evidence.observed_at||"NOT CURRENT"}</dd></div>
          <div><dt>Sampled CI reported green</dt><dd>{evidence.sampled_ci_reported_green?"YES (PARTIAL)":"NO"}</dd></div>
          <div><dt>All required checks independently verified</dt><dd>NO</dd></div>
          <div><dt>Test commands replayed here</dt><dd>NO</dd></div>
          <div><dt>Human approval / merge authority</dt><dd>NONE</dd></div>
        </dl>
        <p className="vpr-warning">{evidence.warning}</p>
      </div>}
    </div>}
    <p className="vpr-boundary">This reuses PhiMadaPrime's existing bounded,
      operator-triggered public GitHub inspector. Its recent-run sample
      cannot establish every required check, job logs, exact test commands,
      product behavior, GMED approval or WITNESS source truth.
      R2 synthetic results remain separate. No workflow execution or write permissions.</p>
  </section>;
}
