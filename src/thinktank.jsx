import React,{useMemo,useState} from "react";
import {OPERATORS,ORI_COUNCIL,BOT_BLUEPRINTS,thinktankSnapshot} from "./thinktank-model.mjs";
import {handoffText} from "./missions.mjs";
import {VesselEvidence} from "./vessel-evidence.jsx";
import {CouncilProvenance} from "./council-provenance.jsx";
import "./thinktank.css";

const PAGES=[
  ["overview","ThinkTank","◈"],["bots","PhiBots","⚙"],["repos","Repo Health","▤"],
  ["builds","Build Queue","≋"],["oversight","Human Oversight","⬡"],
  ["ori","Ori Council","✦"],["pocket","PocketBrain","▣"],
  ["trust","Evidence & Trust","⬡"],["provenance","Council Provenance","◎"]
];
const summaryText="DESIGN / REVIEW ONLY · No runtime, grants, or automatic dispatch connected";
function Panel({title,eyebrow,children,className=""}){
  return <section className={"tt-panel "+className}><header className="tt-panel-head">
    {eyebrow&&<small>{eyebrow}</small>}<h3>{title}</h3>
  </header>{children}</section>;
}
function Evidence({observation}){
  return <span className={"tt-evidence "+observation.kind} title={observation.ci||observation.label}>
    <span aria-hidden="true">●</span> {observation.label}
  </span>;
}
function NumberCard({value,label,detail}){
  return <div className="tt-number"><strong>{value}</strong><span>{label}</span>{detail&&<small>{detail}</small>}</div>;
}
function PersonaCards({people,selected,onSelect}){
  return <div className="tt-personas">{people.map(person=>
    <button type="button" key={person.id} className={"tt-persona "+person.tone+(selected===person.id?" chosen":"")}
      aria-pressed={selected===person.id} onClick={()=>onSelect(person.id)}>
      <span className="tt-persona-glyph" aria-hidden="true">{person.glyph}</span>
      <strong>{person.name}</strong><span>{person.role}</span>
      <small>ROLE BLUEPRINT · NOT ONLINE</small>
    </button>)}</div>;
}
function RepoRows({repos,onInspectRepo,onVisit,busy={}}){
  return repos.length?<div className="tt-repo-list">{repos.map(repo=>
    <article className="tt-repo-row" key={repo.id}>
      <div className="tt-repo-name"><strong>{repo.name}</strong>
        <small>{repo.exampleOnly?"Catalog example · not confirmed live":repo.archived?"Archived public repository":"Public repository"}</small></div>
      <Evidence observation={repo.observation}/>
      <div className="tt-row-actions">
        <button type="button" onClick={()=>onVisit(repo.name)} disabled={repo.exampleOnly}>Visit desk</button>
        <button type="button" disabled={repo.exampleOnly||busy[repo.id]===true}
          onClick={()=>onInspectRepo(repo.id)}>
          {busy[repo.id]?"Checking…":"Inspect CI"}
        </button>
      </div>
    </article>)}</div>:<p className="tt-empty">No repositories match this selection.</p>;
}
function MissionRows({missions,reviewed,pinned,onReview,onPin,onCopy}){
  if(!missions.length)return <p className="tt-empty">No validated Agentora mission plan loaded. Open the existing Mission Board or import a plan to see review proposals here.</p>;
  return <div className="tt-missions">{missions.slice(0,24).map(m=>
    <article className="tt-mission" key={m.id}>
      <div><small>PROPOSAL · PRIORITY {m.priority??"UNSCORED"}</small>
        <strong>{m.repoName} · {m.check.replaceAll("_"," ")}</strong><p>{m.summary}</p>
        <small>HEAD {m.headSha?.slice(0,12)||"UNVERIFIED"} · NEVER DISPATCHED</small></div>
      <div className="tt-mission-controls">
        <button type="button" aria-pressed={reviewed[m.id]===true} onClick={()=>onReview(m.id)}>
          {reviewed[m.id]?"Reviewed locally":"Mark reviewed locally"}</button>
        <button type="button" aria-pressed={pinned[m.id]===true} onClick={()=>onPin(m.id)}>
          {pinned[m.id]?"Unpin":"Pin"}</button>
        <button type="button" onClick={()=>onCopy(m)}>Copy proposal</button>
      </div>
    </article>)}</div>;
}
export function ThinkTank({rows=[],catalogState="loading",signals={},signalsBusy={},
  missions=[],reviewedJobs={},pinnedJobs={},plan=null,onInspectRepo=()=>{},
  onVisit=()=>{},onReview=()=>{},onPin=()=>{},onClose=()=>{}}){
  const [page,setPage]=useState("overview");
  const [r36Report,setR36Report]=useState(null);
  const [selectedOperator,setSelectedOperator]=useState("brainc");
  const [selectedOri,setSelectedOri]=useState("ori-prime");
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [notice,setNotice]=useState("");
  const view=useMemo(()=>thinktankSnapshot({
    rows,signals,missions,reviewed:reviewedJobs,pinned:pinnedJobs,catalogState
  }),[rows,signals,missions,reviewedJobs,pinnedJobs,catalogState]);
  const visibleRepos=useMemo(()=>view.repos.filter(repo=>
    repo.name.toLowerCase().includes(search.trim().toLowerCase())&&
    (filter==="all"||repo.observation.kind===filter)),[view.repos,search,filter]);
  const inspectedRepos=view.repos.filter(repo=>repo.observation.kind!=="unknown").slice(0,8);
  const focusOperator=OPERATORS.find(x=>x.id===selectedOperator)||OPERATORS[0];
  const focusOri=ORI_COUNCIL.find(x=>x.id===selectedOri)||ORI_COUNCIL[0];
  async function copyProposal(m){
    if(!plan){setNotice("A validated Agentora plan must be loaded before a handoff can be copied.");return;}
    try{
      if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(handoffText(m,plan));
      setNotice("Review-only proposal copied. No task dispatched or approved.");
    }catch{setNotice("Clipboard unavailable; no proposal sent or executed.");}
  }
  function open(pageName){setPage(pageName);setNotice("");}
  return <div className="tt-root">
    <header className="tt-heading">
      <div><small>ΦMADA PRIME / OPERATORS ROOM / R35</small>
        <h2>Φ <span>The ThinkTank</span></h2>
        <p>Brains decide. Bots do. Humans approve. <strong>Today this is an evidence-aware planning interface.</strong></p>
      </div>
      <button type="button" className="tt-return" onClick={onClose}>← Return to fleet office</button>
    </header>
    <p className="tt-reality" role="status">{summaryText}</p>
    <nav className="tt-nav" aria-label="ThinkTank rooms">{PAGES.map(([id,label,glyph])=>
      <button type="button" key={id} className={page===id?"active":""}
        aria-current={page===id?"page":undefined} onClick={()=>open(id)}>
        <span aria-hidden="true">{glyph}</span>{label}</button>)}</nav>
    {page==="trust"&&<VesselEvidence onReportChange={setR36Report}/>}
    {page==="provenance"&&<CouncilProvenance r36Report={r36Report}
      onOpenR36={()=>open("trust")}/> }
    {page==="overview"&&<>
      <PersonaCards people={OPERATORS} selected={selectedOperator} onSelect={setSelectedOperator}/>
      <div className="tt-main-grid">
        <Panel title="Active Mission Grid" eyebrow="THINKTANK CORE / REVIEW-ONLY">
          <div className="tt-grid-center">
            <div className="tt-hub" aria-label="Conceptual orchestration map; no agents connected">
              <span className="tt-orbit a">◈</span><span className="tt-orbit b">◇</span>
              <span className="tt-orbit c">✺</span><span className="tt-orbit d">▣</span>
              <strong>Φ</strong><small>MISSION CORE</small>
            </div>
            <div className="tt-grid-brief">
              <h4>{focusOperator.name}</h4><p>{focusOperator.scope}</p>
              <span className="tt-quiet">Conceptual operator role, not an active model session.</span>
              <div className="tt-inline-metrics">
                <NumberCard value={view.totalRepos??"—"} label="Catalog repos"/>
                <NumberCard value={view.proposalCount} label="Proposals"/>
                <NumberCard value={view.inspected} label="Fresh CI observations"/>
              </div>
            </div>
          </div>
        </Panel>
        <div className="tt-rail">
          <Panel title="Public Evidence" eyebrow="ON-DEMAND GITHUB">
            <div className="tt-stack-stats">
              <NumberCard value={view.evidenceCount} label="Observed green CI"/>
              <NumberCard value={view.failures} label="Observed CI issues"/>
              <NumberCard value={view.stale} label="Stale checks"/>
            </div><p className="tt-quiet">Observed CI is not approval, successful deployment, or functional certification.</p>
          </Panel>
          <Panel title="Review Gate" eyebrow="HUMAN OVERSIGHT">
            <div className="tt-stack-stats"><NumberCard value={view.reviewedCount} label="Locally reviewed"/>
              <NumberCard value={view.pinnedCount} label="Pinned"/></div>
            <button type="button" className="tt-primary" onClick={()=>open("oversight")}>Open review queue →</button>
          </Panel>
        </div>
      </div>
      <div className="tt-workstreams">{[
        ["Operators",OPERATORS.length+" designed","overview"],["PhiBots",BOT_BLUEPRINTS.length+" roles","bots"],
        ["Repo Health",String(view.totalRepos??"—")+" cataloged","repos"],
        ["Build Queue",view.inspected+" inspected","builds"],
        ["Ori Council",ORI_COUNCIL.length+" distinct roles","ori"],
        ["PocketBrain","Companion concept","pocket"]].map(([name,value,target])=>
        <button type="button" key={name} onClick={()=>open(target)}><strong>{name}</strong><span>{value}</span><small>Explore →</small></button>)}</div>
    </>}
    {page==="bots"&&<>
      <div className="tt-intro"><h3>PhiBots · orchestration deck</h3>
        <p>Seven proposed specialist roles. Worker availability, queues, and execution are not verified by this interface.</p></div>
      <div className="tt-bot-grid">{BOT_BLUEPRINTS.map(bot=>
        <article className={"tt-bot "+bot.tone} key={bot.name}>
          <span aria-hidden="true">{bot.glyph}</span><h3>{bot.name}</h3><p>{bot.role}</p>
          <small>ROLE BLUEPRINT</small><strong>NOT CONNECTED</strong>
        </article>)}</div>
      <Panel title="Proposed task-routing flow" eyebrow="VISUAL PLAN / NO DISPATCH">
        <div className="tt-flow">{["Scout: plan","Builder: draft","Verifier: inspect","Human: review","Merge: handoff","Deploy: release check"].map((x,i)=>
          <span key={x}>{i+1}. {x}</span>)}</div>
        <p className="tt-quiet">Existing R34 PhiBot Crew Deck inspects pinned public manifest definitions. It does not prove running workers. Use the Mission Board to inspect those definitions.</p>
      </Panel>
    </>}
    {page==="repos"&&<>
      <div className="tt-intro"><h3>Repository Health</h3><p>Based on the public catalog and explicit, on-demand exact-HEAD CI observations. Nothing uninspected is counted healthy.</p></div>
      <div className="tt-metric-strip">
        <NumberCard value={view.totalRepos??"—"} label="Public catalog"/>
        <NumberCard value={view.evidenceCount} label="Observed green"/>
        <NumberCard value={view.failures} label="Observed issue"/>
        <NumberCard value={view.pending} label="Observed pending"/>
        <NumberCard value={view.uninspected} label="Not inspected"/>
      </div>
      <Panel title="Fleet repository table" eyebrow="SEARCH / INSPECT / VISIT">
        <div className="tt-filters"><label>Search repositories
          <input type="search" value={search} placeholder="Name…" onChange={e=>setSearch(e.target.value)}/></label>
          <label>Evidence filter<select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All</option><option value="observed">Observed green</option>
            <option value="failure">Observed issue</option><option value="pending">Observed pending</option>
            <option value="stale">Stale</option><option value="unknown">Not inspected / unknown</option>
          </select></label>
        </div><p className="tt-quiet">{visibleRepos.length} of {view.repos.length} catalog rows · inspect a repo to refresh its evidence.</p>
        <RepoRows repos={visibleRepos.slice(0,80)} onVisit={onVisit} onInspectRepo={onInspectRepo} busy={signalsBusy}/>
        {visibleRepos.length>80&&<p className="tt-quiet">Showing first 80 results. Narrow the search to inspect another repository.</p>}
      </Panel>
    </>}
    {page==="builds"&&<>
      <div className="tt-intro"><h3>Build Queue · evidence board</h3>
        <p>Fresh observed CI and Agentora proposals are displayed separately. This public frontend has no runner queue or merge authority.</p></div>
      <div className="tt-metric-strip">
        <NumberCard value={view.evidenceCount} label="Observed green CI"/>
        <NumberCard value={view.failures} label="Observed failures"/>
        <NumberCard value={view.pending} label="Observed pending"/>
        <NumberCard value={view.proposalCount} label="Review proposals"/>
      </div>
      <Panel title="Observed CI at exact repository HEAD" eyebrow="PUBLIC GITHUB / READ-ONLY">
        <RepoRows repos={inspectedRepos} onVisit={onVisit} onInspectRepo={onInspectRepo} busy={signalsBusy}/>
        {inspectedRepos.length===0&&<p className="tt-quiet">Start with Repo Health → Inspect CI. No active builds are assumed.</p>}
      </Panel>
      <Panel title="Planning queue, not a runtime queue" eyebrow="AGENTORA / REVIEW ONLY">
        <MissionRows missions={missions} reviewed={reviewedJobs} pinned={pinnedJobs}
          onReview={onReview} onPin={onPin} onCopy={copyProposal}/>
      </Panel>
    </>}
    {page==="oversight"&&<>
      <div className="tt-intro"><h3>Human Oversight</h3>
        <p>Review, pin, and copy proposals for an external authorized workflow. Marking a proposal reviewed here is not a GitHub approval or permission grant.</p></div>
      <div className="tt-metric-strip">
        <NumberCard value={view.proposalCount} label="Proposals"/>
        <NumberCard value={view.reviewedCount} label="Reviewed locally"/>
        <NumberCard value={view.pinnedCount} label="Pinned locally"/>
        <NumberCard value="0" label="Approvals or grants issued"/>
      </div>
      <Panel title="Review queue" eyebrow="HUMAN AUTHORITY / NO WRITES">
        <MissionRows missions={missions} reviewed={reviewedJobs} pinned={pinnedJobs}
          onReview={onReview} onPin={onPin} onCopy={copyProposal}/>
      </Panel>
      <Panel title="Review boundary" eyebrow="LEDGER ABOVE EGO">
        <p>Before any real build, merge, or deployment: confirm current repository HEAD, required checks, design intent, risk and scope, then authorize in the connected tool that owns the operation.</p>
      </Panel>
    </>}
    {page==="ori"&&<>
      <div className="tt-intro"><h3>Ori Council · a separate team</h3>
        <p>Distinct from Vessie, Gaia, BrainC, and PocketBrain. This council proposes perspectives; it does not impersonate active agents.</p></div>
      <PersonaCards people={ORI_COUNCIL} selected={selectedOri} onSelect={setSelectedOri}/>
      <div className="tt-main-grid">
        <Panel title="Ori Council Chamber" eyebrow="THE SECOND OPERATORS ROOM">
          <div className="tt-grid-center"><div className="tt-hub ori" aria-hidden="true">
            <span className="tt-orbit a">♛</span><span className="tt-orbit b">◎</span>
            <span className="tt-orbit c">⚒</span><span className="tt-orbit d">⬡</span>
            <strong>Φ</strong><small>ORI COUNCIL</small></div>
            <div className="tt-grid-brief"><h4>{focusOri.name}</h4><p>{focusOri.scope}</p>
              <span className="tt-quiet">No council session or PhiBot dispatch currently connected.</span></div></div>
        </Panel>
        <Panel title="Council to PhiBots" eyebrow="PROPOSED DELEGATION">
          <div className="tt-role-map">
            {["Scout Ori → Scout Bot","Forge Ori → Builder Bot","Guardian Ori → Verifier Bot",
            "Ori Prime → Merge review","Pocket Ori → Doc summaries"].map(x=><span key={x}>{x}</span>)}
          </div><button type="button" className="tt-primary" onClick={()=>open("bots")}>Inspect bot roles →</button>
        </Panel>
      </div>
    </>}
    {page==="pocket"&&<>
      <div className="tt-intro"><h3>PocketBrain Companion</h3>
        <p>Mobile, tablet and Gen.E-Wrist design direction. This responsive preview performs no remote approvals or dispatch.</p></div>
      <div className="tt-device-grid">
        <section className="tt-device phone"><small>PHONE / QUICK TRIAGE</small><h3>▣ PocketBrain</h3>
          <div className="tt-device-item"><strong>{view.proposalCount} proposals</strong><span>Review on full dashboard</span></div>
          <div className="tt-device-item"><strong>{view.failures} observed CI issues</strong><span>Only after public inspection</span></div>
          <div className="tt-device-item"><strong>{view.pinnedCount} pinned</strong><span>Local session only</span></div>
          <button type="button" onClick={()=>open("oversight")}>Open reviews →</button>
        </section>
        <section className="tt-device tablet"><small>TABLET / PORTABLE COMMAND DECK</small><h3>Φ ThinkTank Summary</h3>
          <div className="tt-metric-strip"><NumberCard value={view.totalRepos??"—"} label="Repos"/>
            <NumberCard value={view.inspected} label="Inspected"/><NumberCard value={view.proposalCount} label="Proposals"/></div>
          <p>Check evidence, open missions and hand off proposals with explicit human review.</p>
          <button type="button" onClick={()=>open("repos")}>Open Repo Health →</button>
        </section>
        <section className="tt-device watch"><small>WRIST / GLANCE VIEW</small><h3>Φ</h3>
          <strong>{view.failures} CI issues</strong><span>{view.proposalCount} proposals</span>
          <small>READ-ONLY · NO APPROVAL BUTTON</small>
        </section>
      </div>
    </>}
    {notice&&<p className="tt-notice" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>Dismiss</button></p>}
    <footer className="tt-footer">R35–R37 VISUAL ORCHESTRATION · PUBLIC CATALOG + USER-TRIGGERED GITHUB INSPECTION · ZERO AUTOMATIC WORKER EXECUTION</footer>
  </div>;
}
