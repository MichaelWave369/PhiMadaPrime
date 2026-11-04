import React, { useMemo, useState } from "react";
import { completionLane } from "./completion-lane.mjs";
import { AgentoraR03Return } from "./agentora-r03-return.jsx";

const ORDER = [
  ["1", "Select one real repo"],
  ["2", "Inspect current GitHub HEAD"],
  ["3", "Scope a completion contract"],
  ["4", "Export a local verification request"],
  ["5", "Agentora verification and independent evidence review"],
  ["6", "Human release / merge decision"]
];

export function OneRepoCompletionLane({catalog=[],contracts={},signals={},
  signalsBusy={},signalsError={},onInspectRepo,onVisit,onExportVerification}) {
  const [selectedId,setSelectedId]=useState("");
  const [filter,setFilter]=useState("");
  const repos=useMemo(()=>catalog.filter(row=>row && !row.exampleOnly &&
    Number.isSafeInteger(row.id) && row.id>0 &&
    row.full_name==="MichaelWave369/"+row.name)
    .sort((a,b)=>a.name.localeCompare(b.name,"en",{sensitivity:"base"})),[catalog]);
  const selected=repos.find(row=>String(row.id)===selectedId)||null;
  const matched=repos.filter(row=>(row.name+" "+(row.description||""))
    .toLowerCase().includes(filter.trim().toLowerCase()));
  const options=matched.slice(0,30);
  if(selected && !options.some(row=>row.id===selected.id))options.unshift(selected);
  const signal=selected?signals[selected.id]:null;
  const contract=selected?contracts[selected.id]:null;
  const status=completionLane(selected,signal,contract);
  const loading=selected && signalsBusy[selected.id]===true;
  const error=selected && signalsError[selected.id];
  const ready=status.readyToExport && !error && !loading;
  return <section className="one-repo-lane" aria-label="One-repository completion lane">
    <div className="one-repo-lane-title">
      <div>
        <small>ΦMADA PRIME / OPERATOR WORKFLOW</small>
        <h3>ONE REPO · FINISH LANE</h3>
        <p>Select any real public fleet project. See exactly what is missing
          before preparing a governed verification request.</p>
      </div>
      <strong>NO AUTO DISPATCH · NO AUTO MERGE</strong>
    </div>
    <div className="one-repo-lane-picker">
      <label>Find a repository
        <input type="search" value={filter} onChange={e=>setFilter(e.target.value)}
          placeholder="Search the full public fleet…" />
      </label>
      <label>Current project
        <select aria-label="Choose a repository for completion"
          value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
          <option value="">Choose one public repo…</option>
          {options.map(row=><option key={row.id} value={String(row.id)}>{row.name}</option>)}
        </select>
      </label>
      <small>{repos.length} real public repos discovered. Showing {matched.length>30?
        "first 30 matching results; refine search":"all "+matched.length+" matching results"}.
        One repository inspected only when requested.</small>
    </div>
    <ol className="one-repo-lane-steps">
      {ORDER.map(([number,label])=><li key={number}><b>{number}</b>{label}</li>)}
    </ol>
    {selected?<div className="one-repo-lane-result" aria-live="polite">
      <div className="one-repo-lane-status">
        <strong>{selected.name}</strong>
        <span>{status.stage.replaceAll("_"," ")}</span>
      </div>
      <p>{error?"Public GitHub refresh failed. Refresh before exporting a request.":
        status.message}</p>
      <dl className="one-repo-lane-facts">
        <div><dt>Observed HEAD</dt><dd>{status.observedHeadSha?.slice(0,12)||"Not inspected"}</dd></div>
        <div><dt>Contract SHA</dt><dd>{status.contractSha?.slice(0,12)||"Not scoped"}</dd></div>
        <div><dt>Operator checklist</dt><dd>{status.locallyReviewed}/{status.requiredChecks} locally reviewed</dd></div>
        <div><dt>Independently verified</dt><dd>0 checks</dd></div>
      </dl>
      <div className="one-repo-lane-actions">
        <button type="button" disabled={Boolean(loading)||!onInspectRepo}
          onClick={()=>onInspectRepo(selected.id)}>
          {loading?"Inspecting GitHub…":"Inspect / refresh HEAD"}
        </button>
        <button type="button" disabled={!onVisit}
          onClick={()=>onVisit(selected.name)}>
          Open project desk / contract
        </button>
        <button type="button" disabled={!ready||!onExportVerification}
          onClick={()=>onExportVerification(selected.id)}>
          Download governed request
        </button>
      </div>
      <AgentoraR03Return key={selected.id} repo={selected}
        contract={contract} signal={signal} />
      <p className="one-repo-lane-disclaimer">This exports an existing R8
        local request, not an Agentora job. Source must be recently observed,
        exact-SHA matched and contract-valid. Independent execution evidence
        and release approval require separate human-controlled workflows.
        No project is marked complete by this panel.</p>
    </div>:<p className="one-repo-lane-empty">Choose a real public repository above to
      begin a source-bound completion review. No Agentora pilot plan is required
      to select and scope a project.</p>}
  </section>;
}
