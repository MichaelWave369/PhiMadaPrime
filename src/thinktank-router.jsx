import React,{useMemo,useState} from "react";
import {routeProposal,routingHandoff} from "./thinktank-routing.mjs";
import "./thinktank-router.css";

const HEADER={
  PLAN_HEAD_UNKNOWN:"Plan HEAD missing",
  NOT_INSPECTED:"Repo not inspected",
  OBSERVATION_STALE:"Observation stale",
  CURRENT_HEAD_UNKNOWN:"Current HEAD unavailable",
  HEAD_MOVED:"Source HEAD moved",
  HEAD_MATCH_OBSERVED:"Heads match (observed)"
};
export function MissionRouter({missions=[],plan=null,rows=[],signals={},signalsBusy={},
    reviewedJobs={},pinnedJobs={},onInspectRepo=()=>{},onVisit=()=>{},
    onReview=()=>{},onPin=()=>{},onOpenMissionBoard=()=>{}}){
  const [query,setQuery]=useState("");
  const [selectedId,setSelectedId]=useState("");
  const [notice,setNotice]=useState("");
  const matched=useMemo(()=>missions.filter(m=>
    [m.repoName,m.check,m.summary,m.wing].some(x=>
      String(x||"").toLowerCase().includes(query.trim().toLowerCase()))),
    [missions,query]);
  const displayed=matched.slice(0,60);
  const selected=displayed.find(m=>m.id===selectedId)||displayed[0]||null;
  const repo=selected?rows.find(r=>r.id===selected.repoId&&
    r.full_name?.toLowerCase()===selected.repository?.toLowerCase()):null;
  const route=useMemo(()=>{
    if(!selected||!plan||!repo)return null;
    try{return routeProposal(selected,plan,repo,signals[repo.id]);}
    catch{return null;}
  },[selected,plan,repo,signals]);
  async function copy(){
    if(!route||!selected||!plan||!repo){setNotice("No validated proposal can be copied.");return;}
    try{
      if(!navigator.clipboard?.writeText)throw Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(routingHandoff(selected,plan,repo,signals[repo.id]));
      setNotice("Review dossier copied. No code, job, approval or message was sent.");
    }catch{setNotice("Clipboard unavailable. No dossier was sent.");}
  }
  return <div className="tt-router" aria-label="Mission routing workbench">
    <div className="tt-intro">
      <h3>Mission Router · Council → PhiBot</h3>
      <p>Rule-based suggestions from validated Agentora plans. They are not decisions from live models or tasks assigned to running agents.</p>
    </div>
    <section className="tt-router-flow" aria-label="Review-only routing sequence">
      <span>1 · Agentora proposal</span><span>2 · Core operator</span>
      <span>3 · Ori council</span><span>4 · PhiBot blueprint</span>
      <span>5 · Human review</span>
    </section>
    {!plan||!missions.length?<section className="tt-panel tt-router-empty">
      <header className="tt-panel-head"><small>WAITING FOR VALIDATED SOURCE</small><h3>No Agentora proposals loaded</h3></header>
      <p>Open the Mission Board to inspect or import a validated Agentora completion plan. The router cannot invent missions from repository names.</p>
      <button type="button" className="tt-primary" onClick={onOpenMissionBoard}>Open Mission Board →</button>
    </section>:<>
      <div className="tt-router-layout">
        <section className="tt-panel tt-router-select">
          <header className="tt-panel-head"><small>REAL PLAN · PROPOSALS ONLY</small><h3>Select a mission</h3></header>
          <label className="tt-router-search">Filter proposals
            <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="Repository, task, check…" /></label>
          <p className="tt-quiet">{matched.length} matching proposals · showing up to 60</p>
          <div className="tt-router-list">
            {displayed.map(m=><button type="button" key={m.id} aria-pressed={selected?.id===m.id}
              className={selected?.id===m.id?"tt-router-selected":""} onClick={()=>setSelectedId(m.id)}>
              <strong>{m.repoName}</strong><span>{m.check.replaceAll("_"," ")}</span>
              <small>{m.priority===null?"Unscored":"Priority "+m.priority}
                {pinnedJobs[m.id]?" · Pinned":""}</small>
            </button>)}
            {!displayed.length&&<p className="tt-empty">No matching plan proposals. Try a different filter.</p>}
          </div>
        </section>
        {route?<section className="tt-panel tt-router-detail" aria-live="polite">
          <header className="tt-panel-head"><small>DETERMINISTIC SUGGESTION · NEVER DISPATCHED</small>
            <h3>{selected.repoName} / {selected.check.replaceAll("_"," ")}</h3></header>
          <p>{selected.summary}</p>
          <div className="tt-route-chain">
            <div><small>CORE OPERATOR · CONCEPT</small><strong>{route.operator}</strong></div>
            <div><small>ORI COUNCIL · CONCEPT</small><strong>{route.council}</strong></div>
            <div><small>PHIBOT ROLE · NOT INSTALLED</small><strong>{route.bot}</strong></div>
          </div>
          <p className="tt-quiet">Routing rule: <strong>{route.category}</strong>. {route.explanation}</p>
          <div className="tt-route-evidence">
            <h4>Evidence & review gate</h4>
            <span className={route.evidenceGate==="READY_FOR_HUMAN_REVIEW"?"tt-gate-ready":"tt-gate-hold"}>
              {route.evidenceGate==="READY_FOR_HUMAN_REVIEW"?
                "READY FOR HUMAN REVIEW · NOT APPROVED":"RECHECK REQUIRED · NO EXECUTION"}
            </span>
            <dl>
              <div><dt>Plan freshness</dt><dd>{route.planStatus}</dd></div>
              <div><dt>Head comparison</dt><dd>{HEADER[route.headStatus]}</dd></div>
              <div><dt>Plan HEAD</dt><dd><code>{route.planHead?.slice(0,12)||"UNKNOWN"}</code></dd></div>
              <div><dt>Observed HEAD</dt><dd><code>{route.observedHead?.slice(0,12)||"NOT VERIFIED"}</code></dd></div>
              <div><dt>Exact-head CI</dt><dd>{route.ciState.replaceAll("_"," ")}</dd></div>
            </dl>
            <ul>{route.notes.map(note=><li key={note}>{note}</li>)}</ul>
          </div>
          <div className="tt-router-actions">
            <button type="button" onClick={()=>onInspectRepo(repo.id)} disabled={signalsBusy[repo.id]===true}>
              {signalsBusy[repo.id]?"Inspecting…":"Inspect current GitHub HEAD"}
            </button>
            <button type="button" onClick={()=>onVisit(repo.name)}>Visit repository desk</button>
            <button type="button" aria-pressed={pinnedJobs[selected.id]===true}
              onClick={()=>onPin(selected.id)}>{pinnedJobs[selected.id]?"Unpin proposal":"Pin proposal"}</button>
            <button type="button" aria-pressed={reviewedJobs[selected.id]===true}
              onClick={()=>onReview(selected.id)}>
              {reviewedJobs[selected.id]?"Locally reviewed ✓":"Mark reviewed locally"}
            </button>
            <button type="button" className="tt-copy-handoff" onClick={copy}>
              Copy review dossier
            </button>
          </div>
          <p className="tt-quiet">Copying includes the original Agentora review handoff and the routing suggestion. Local review and copying never grant authority, invoke a bot, write to GitHub or approve a PR.</p>
        </section>:<section className="tt-panel"><h3>Unable to route selected proposal</h3>
          <p className="tt-empty">Source or repository identity could not be validated. No suggestion generated.</p></section>}
      </div>
    </>}
    {notice&&<div className="tt-notice" role="status">{notice}
      <button type="button" onClick={()=>setNotice("")}>Dismiss</button></div>}
  </div>;
}
