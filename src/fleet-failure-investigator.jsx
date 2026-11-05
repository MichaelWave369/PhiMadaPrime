import React,{useEffect,useMemo,useRef,useState} from "react";
import {
  eligibleFailureRepo,scanFleetFailures,inspectFleetFailure,
  failureInvestigationHandoff
} from "./fleet-failure-investigator.mjs";
import "./fleet-failure-investigator.css";

function runState(row,headSha){
  return row.sha===headSha?
    "MATCHES OBSERVED DEFAULT HEAD":
    "OTHER BRANCH OR OLDER THAN OBSERVED DEFAULT HEAD";
}
export function FleetFailureInvestigator({catalog=[]}){
  const [query,setQuery]=useState("");
  const [candidate,setCandidate]=useState("");
  const [cohort,setCohort]=useState([]);
  const [scan,setScan]=useState(null);
  const [selected,setSelected]=useState(null);
  const [investigation,setInvestigation]=useState(null);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const generation=useRef(0);
  useEffect(()=>()=>{generation.current++;},[]);
  const eligible=useMemo(()=>catalog.filter(eligibleFailureRepo)
    .sort((a,b)=>a.name.localeCompare(b.name)),[catalog]);
  const matching=eligible.filter(r=>(r.name+" "+(r.description||""))
    .toLowerCase().includes(query.trim().toLowerCase()));
  const options=matching.slice(0,35);
  const choice=eligible.find(r=>String(r.id)===candidate);
  if(choice&&!options.some(r=>r.id===choice.id))options.unshift(choice);
  const selectedRun=scan?.reports
    .find(r=>r.repositoryId===selected?.repoId)?.runs
    .find(run=>run.id===selected?.runId)||null;
  function reset(){
    generation.current++;
    setScan(null);setSelected(null);setInvestigation(null);
    setError("");setNotice("");setBusy("");
  }
  function addRepo(){
    if(!choice||cohort.includes(choice.id)||cohort.length>=4)return;
    reset();setCohort(ids=>[...ids,choice.id]);
    setCandidate("");
  }
  function removeRepo(id){
    reset();setCohort(ids=>ids.filter(x=>x!==id));
  }
  async function investigate(){
    if(!cohort.length||busy)return;
    const ticket=++generation.current;
    setScan(null);setSelected(null);setInvestigation(null);
    setError("");setNotice("");setBusy("scan");
    try{
      const answer=await scanFleetFailures(eligible,cohort);
      if(ticket===generation.current)setScan(answer);
    }catch{
      if(ticket===generation.current)
        setError("Cohort could not be validated. No fleet incident evidence inferred.");
    }finally{
      if(ticket===generation.current)setBusy("");
    }
  }
  function choose(runId,repoId){
    generation.current++;
    setSelected({runId,repoId});setInvestigation(null);
    setError("");setNotice("");setBusy("");
  }
  async function inspect(){
    if(!scan||!selected||busy)return;
    const ticket=++generation.current;
    setBusy("jobs");setError("");setNotice("");setInvestigation(null);
    try{
      const answer=await inspectFleetFailure(scan,selected.repoId,selected.runId);
      if(ticket===generation.current)setInvestigation(answer);
    }catch{
      if(ticket===generation.current)setError(
        "This run changed, its repository HEAD moved, or GitHub evidence is unavailable. Rescan the cohort before trusting it.");
    }finally{
      if(ticket===generation.current)setBusy("");
    }
  }
  async function copy(){
    if(!investigation||!scan)return;
    try{
      if(!navigator.clipboard?.writeText)throw Error("NO_CLIPBOARD");
      await navigator.clipboard.writeText(failureInvestigationHandoff(scan,investigation));
      setNotice("Exact-SHA failure handoff copied locally; nothing submitted.");
    }catch{
      setNotice("Clipboard unavailable. No handoff copied.");
    }
  }
  return <section className="r33-investigator" aria-label="R33 bounded public fleet failure investigator">
    <header className="r33-header">
      <div><small>ΦMADA PRIME / R33 / FLEET FAILURE INVESTIGATOR</small>
        <h3>THE INCIDENT RADAR</h3>
        <p>Search for genuinely failed GitHub Actions runs across a handpicked
          group of public repositories. Inspect their jobs and recorded failing
          steps without executing anything.</p>
      </div>
      <strong>SELECTED COHORT · READ ONLY · NO FALSE CRISES</strong>
    </header>
    <div className="r33-chooser">
      <label>Filter public fleet repositories
        <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
          placeholder="e.g. PhiMadaPrime, Agentora, BTM"/>
      </label>
      <label>Choose repository
        <select value={candidate} onChange={e=>setCandidate(e.target.value)}
          aria-label="Incident radar repository selector">
          <option value="">Select one repository…</option>
          {options.map(r=><option key={r.id} value={String(r.id)}>{r.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={addRepo}
        disabled={!choice||cohort.includes(choice.id)||cohort.length>=4}>
        Add to cohort
      </button>
    </div>
    <p className="r33-muted">{eligible.length} eligible public repositories.
      {matching.length>35?" First 35 matches shown; refine search.":""}
      {" "}Choose at most four for each explicit scan. No continuous monitoring or fleet-wide crawl.</p>
    <div className="r33-scope">
      <div><strong>SELECTED COHORT · {cohort.length}/4</strong>
        <div className="r33-tags">
          {cohort.map(id=>{
            const r=eligible.find(x=>x.id===id);
            return <span key={id}>{r?.name||"Missing repository"}
              <button type="button" onClick={()=>removeRepo(id)}
                aria-label={"Remove "+(r?.name||"repository")+" from cohort"}>×</button>
            </span>;
          })}
          {!cohort.length&&<small>No repositories selected yet.</small>}
        </div>
      </div>
      <button type="button" disabled={Boolean(busy)||!cohort.length}
        onClick={investigate}>
        {busy==="scan"?"Scanning selected public repos…":
          scan?"Refresh selected cohort":"Scan historical failures"}
      </button>
    </div>
    {error&&<p role="alert" className="r33-warning">{error}</p>}
    {scan&&<>
      <div className="r33-kpis">
        <div><strong>{scan.selectedRepos}</strong><span>Repos selected</span></div>
        <div><strong>{scan.observedRepos}</strong><span>Repo reads verified</span></div>
        <div><strong>{scan.failuresShown}</strong><span>Failed runs shown</span></div>
        <div><strong>{scan.unavailableRepos}</strong><span>Unavailable repos</span></div>
      </div>
      <p className="r33-muted">Observed {scan.observedAt}. Only runs with GitHub
        conclusion <code>failure</code> were queried. Timeouts and cancellations
        are separate outcomes not included in this scan.</p>
      {scan.partial&&<p className="r33-warning">
        Coverage is partial: at least one repository was unavailable or GitHub
        reported additional runs beyond a bounded first page. This is not a
        complete fleet or security incident inventory.</p>}
      <div className="r33-repos">
        {scan.reports.map(report=><article className="r33-repo" key={report.repositoryId}>
          <header><strong>{report.repository.split("/")[1]}</strong>
            <span>{report.state==="OBSERVED"?"GITHUB OBSERVED":"UNAVAILABLE"}</span>
          </header>
          {report.state==="UNAVAILABLE"?
            <p className="r33-warning">Public GitHub read unavailable or
              failed identity verification. No conclusion inferred. <code>{
                report.reason}</code></p> : <>
              <p className="r33-muted">Default branch <code>{report.defaultBranch}</code>{" · "}
                observed HEAD <code>{report.defaultHeadSha.slice(0,12)}</code>.
                {" "}GitHub reports {report.totalReported} matching failed runs;
                displaying {report.runs.length}.</p>
              {report.partial&&<p className="r33-warning">
                First eight failures or fewer; some entries may be excluded.
                Older failures may not be shown.</p>}
              {report.runs.length===0?<p className="r33-muted">
                None returned by this bounded public API query. This does not
                prove all workflows are healthy.</p>:
              <ul className="r33-runs">
                {report.runs.map(run=><li key={run.id}>
                  <div><strong>{run.name}</strong>
                    <small>{run.path} · {run.event} · attempt {run.attempt}</small>
                    <small>Failed run SHA {run.sha.slice(0,12)} · {
                      run.createdAt||"time unavailable"}</small>
                    <em>{runState(run,report.defaultHeadSha)}</em></div>
                  <button type="button" disabled={Boolean(busy)}
                    aria-pressed={selected?.runId===run.id&&
                      selected?.repoId===report.repositoryId}
                    onClick={()=>choose(run.id,report.repositoryId)}>
                    {selected?.runId===run.id&&selected?.repoId===report.repositoryId?
                      "Selected":"Investigate"}
                  </button>
                </li>)}
              </ul>}
            </>}
        </article>)}
      </div>
    </>}
    {scan&&selectedRun&&<div className="r33-detail">
      <div className="r33-detail-heading">
        <div><small>SELECTED HISTORICAL FAILURE</small>
          <h4>{selectedRun.name}</h4>
          <p>Run <code>{selectedRun.id}</code>, attempt {selectedRun.attempt},
            failing commit <code>{selectedRun.sha}</code>.</p></div>
        <button type="button" onClick={inspect} disabled={Boolean(busy)}>
          {busy==="jobs"?"Reading GitHub jobs…":
            investigation?"Refresh investigation":"Inspect failed jobs + steps"}
        </button>
      </div>
      <div className="r33-links">
        <a href={selectedRun.url} rel="noopener noreferrer" target="_blank">
          Inspect full run on GitHub ↗</a>
        <a href={selectedRun.commitUrl} rel="noopener noreferrer" target="_blank">
          Inspect exact commit on GitHub ↗</a>
      </div>
      {investigation&&investigation.run.id===selectedRun.id&&<>
        <p className="r33-muted">Job details observed {investigation.detailsObservedAt}.
          {" "}Default HEAD was independently revalidated at inspection time.
          This failure may already have been fixed.</p>
        {investigation.partial&&<p className="r33-warning">
          Run/job/step evidence is incomplete. Do not infer a complete failure
          signature from the visible records.</p>}
        <div className="r33-job-stats">
          <span><b>{investigation.failingJobs}</b> explicitly failed jobs</span>
          <span><b>{investigation.failureSteps.length}</b> explicitly failed steps</span>
          <span><b>{investigation.jobs.jobs.length}</b> jobs observed</span>
        </div>
        {investigation.failureSteps.length>0?<ul className="r33-failed-steps">
          {investigation.failureSteps.map(step=><li key={step.jobId+":"+step.stepNumber}>
            <div><strong>{step.jobName} · Step {step.stepNumber}</strong>
              <small>{step.stepName}</small></div>
            <a href={step.jobUrl} rel="noopener noreferrer" target="_blank">
              Open job ↗</a>
          </li>)}
        </ul>:<p className="r33-muted">
          No explicitly failed steps in returned metadata. Check job details
          manually; missing or partial steps are not proof of success.</p>}
        <details className="r33-all-jobs">
          <summary>Review all {investigation.jobs.jobs.length} returned jobs</summary>
          {investigation.jobs.jobs.map(job=><p key={job.id}>
            <a href={job.url} rel="noopener noreferrer" target="_blank">{job.name}</a>
            {" · "}{job.status} · {job.conclusion||"no conclusion"}
            {job.stepsPartial?" · partial step data":""}
          </p>)}
        </details>
        <button type="button" onClick={copy}>Copy review-only failure handoff</button>
        {notice&&<p role="status" className="r33-notice">{notice}</p>}
      </>}
    </div>}
    {!scan&&!busy&&!error&&<p className="r33-empty">
      Pick up to four public repositories and explicitly scan their failed
      GitHub Actions runs. No failures are asserted before a live read.</p>}
    <footer className="r33-footer">This is an investigator, not an incident
      detector or a root-cause engine. Historical failures can be fixed, and
      feature-branch failures do not necessarily affect the default branch.
      No logs downloaded, tests started, files changed, or merges approved.</footer>
  </section>;
}
