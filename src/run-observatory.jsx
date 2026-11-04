import React,{useEffect,useRef,useState} from "react";
import {
  readRunList,readRunJobs,runObservatoryHandoff
} from "./run-observatory.mjs";
import "./run-observatory.css";

function displayStatus(status,conclusion){
  return status==="completed"?("completed · "+(conclusion||"unknown outcome")):
    (status||"unknown status");
}
export function RunObservatory({repo,history,commit,bundle}){
  const [list,setList]=useState(null);
  const [selected,setSelected]=useState(0);
  const [details,setDetails]=useState(null);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const generation=useRef(0);
  useEffect(()=>()=>{generation.current++;},[]);
  const picked=list?.runs.find(run=>run.id===selected)||null;

  async function loadRuns(){
    if(busy)return;
    const ticket=++generation.current;
    setList(null);setSelected(0);setDetails(null);setError("");setNotice("");
    setBusy("runs");
    try{
      const result=await readRunList(repo,history,commit,bundle);
      if(ticket===generation.current)setList(result);
    }catch(error){
      if(ticket===generation.current)setError("GitHub run inventory unavailable or commit identity changed; no workflow outcome inferred.");
    }finally{
      if(ticket===generation.current)setBusy("");
    }
  }
  function chooseRun(value){
    generation.current++;
    setSelected(Number(value));setDetails(null);setBusy("");setError("");setNotice("");
  }
  async function loadJobs(){
    if(busy || !picked || !list)return;
    const ticket=++generation.current;
    setBusy("jobs");setDetails(null);setError("");setNotice("");
    try{
      const value=await readRunJobs(repo,history,commit,bundle,list,picked.id);
      if(ticket===generation.current)setDetails(value);
    }catch{
      if(ticket===generation.current)setError("Run changed, jobs were partial/unavailable, or GitHub identity did not match. Reload the run inventory.");
    }finally{
      if(ticket===generation.current)setBusy("");
    }
  }
  async function copy(){
    if(!list || !details)return;
    try{
      if(!navigator.clipboard?.writeText)throw Error("NO_CLIPBOARD");
      await navigator.clipboard.writeText(runObservatoryHandoff(list,details));
      setNotice("Read-only run evidence copied locally; no GitHub action taken.");
    }catch{
      setNotice("Clipboard unavailable; no handoff copied.");
    }
  }
  return <section className="r32-observatory" aria-label="R32 Run Observatory exact SHA workflow inspections">
    <header className="r32-header">
      <div><small>ΦMADA PRIME / R32 / RUN OBSERVATORY</small>
        <h4>THE EXECUTION TELESCOPE</h4>
        <p>Inspect real GitHub Actions runs, jobs and step outcomes tied to this
          Chronicle commit. Read-only observations, not job execution.</p></div>
      <span>EXACT SHA · NO RERUNS · NO LOG DOWNLOADS</span>
    </header>
    <div className="r32-actions">
      <div><strong>Selected commit</strong>
        <code>{commit.sha}</code></div>
      <button type="button" disabled={Boolean(busy)} onClick={loadRuns}>
        {busy==="runs"?"Reading workflows…":list?"Refresh workflow runs":"Load GitHub workflow runs"}
      </button>
    </div>
    {error && <p className="r32-warning" role="alert">{error}</p>}
    {!list && !busy && !error && <p className="r32-muted">
      No workflow runs have been inspected. Loading is manual, and does not
      start tests, rerun failed jobs or access private repositories.</p>}
    {list && <>
      <div className="r32-meta">
        <strong>RUN INVENTORY</strong>
        <span>{list.runs.length} displayed / {list.totalReported} GitHub-reported · {
          list.observedAt}</span>
      </div>
      {list.partial && <p className="r32-warning">
        This is a bounded first-page observation. Some runs were excluded
        or more may exist. No exhaustive workflow coverage is claimed.</p>}
      {list.runs.length ? <>
        <ol className="r32-run-list">
          {list.runs.map(run=><li key={run.id}>
            <button type="button" className={selected===run.id?"r32-selected":""}
              aria-pressed={selected===run.id} onClick={()=>chooseRun(String(run.id))}>
              <span><strong>{run.name}</strong>
                <small>{run.path} · {run.event} · attempt {run.attempt}</small>
                <small>{run.createdAt||"creation date unavailable"}</small></span>
              <em>{displayStatus(run.status,run.conclusion)}</em>
            </button>
          </li>)}
        </ol>
        {picked && <div className="r32-picker">
          <p>Selected: <strong>{picked.name}</strong> · run <code>{picked.id}</code> · {
            displayStatus(picked.status,picked.conclusion)}</p>
          <div>
            <button type="button" onClick={loadJobs} disabled={Boolean(busy)}>
              {busy==="jobs"?"Reading jobs…":"Inspect run jobs + steps"}
            </button>
            <a href={picked.url} target="_blank" rel="noopener noreferrer">Open run on GitHub ↗</a>
          </div>
        </div>}
      </> : <p className="r32-muted">
        No matching workflow runs in this first GitHub response. This does not
        establish that no workflow has ever existed for the repository.</p>}
    </>}
    {details && picked && details.runId===picked.id && <div className="r32-job-panel">
      <div className="r32-meta"><strong>JOBS + STEPS · attempt {details.attempt}</strong>
        <span>{details.jobs.length}/{details.totalReported} jobs · {details.observedAt}</span></div>
      <p className="r32-summary">{details.summary.replaceAll("_"," ")} · {
        details.counts.success} passed · {details.counts.other} other completed · {
        details.counts.pending} unfinished</p>
      {details.partial && <p className="r32-warning">
        Job or step coverage is incomplete; no all-green conclusion can be drawn.</p>}
      {details.jobs.length===0 && <p className="r32-muted">No jobs returned for this run.</p>}
      <div className="r32-job-grid">
        {details.jobs.map(job=><article key={job.id} className="r32-job">
          <header><div><strong>{job.name}</strong>
            <small>{displayStatus(job.status,job.conclusion)}</small></div>
            <a href={job.url} target="_blank" rel="noopener noreferrer">Job ↗</a>
          </header>
          <p className="r32-muted">Started: {job.startedAt||"unknown"} · Finished: {
            job.completedAt||"unknown"}</p>
          {job.stepsPartial && <p className="r32-warning">
            Step details missing or truncated. Use GitHub for full evidence.</p>}
          {job.steps.length>0?<ol className="r32-step-list">
            {job.steps.map(step=><li key={step.number}>
              <span><b>{step.number}. {step.name}</b>
                <small>{step.startedAt||"no start"} · {step.completedAt||"no end"}</small></span>
              <em>{displayStatus(step.status,step.conclusion)}</em>
            </li>)}
          </ol>:<p className="r32-muted">No step details reported by GitHub.</p>}
        </article>)}
      </div>
      <button type="button" onClick={copy}>Copy exact-SHA run evidence handoff</button>
      {notice && <p role="status" className="r32-notice">{notice}</p>}
    </div>}
    <p className="r32-disclaimer">Job dependencies are not inferred from their order
      here. A completed workflow or a successful step does not identify an AI worker,
      prove full required-check coverage, certify device acceptance, or authorize
      a merge. All data are public GitHub API observations.</p>
  </section>;
}
