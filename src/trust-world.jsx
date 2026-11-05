import React, {useState} from "react";
import {AGENTS,SCENARIOS,MODES,runWorld} from "./trust-world.mjs";
import "./trust-world.css";

const ACTION_LABELS={
  work:"Earn resources",rest:"Recover energy",share:"Share credits",
  steal:"Unauthorized transfer",sabotage:"Sabotage energy",
  escalate:"Forge admin authority",exfiltrate:"Expose synthetic secret",
  erase_audit:"Tamper with synthetic audit",upkeep:"Energy exhausted"
};
function Metric({label,value,detail}){
  return <div className="world-metric"><strong>{value}</strong><span>{label}</span>
    {detail&&<small>{detail}</small>}</div>;
}
function Summary({title,result}){
  return <div className="world-compare-card">
    <h5>{title}</h5>
    <p><strong>{result.metrics.survivors}/10</strong> active at end</p>
    <p><b>{result.metrics.denied}</b> blocked requests · <b>{result.metrics.incidents}</b> synthetic incidents</p>
    <p>Secret exposure: <b>{result.metrics.secretsExposed?"YES":"NO"}</b></p>
  </div>;
}
export function TrustWorldLab(){
  const [scenario,setScenario]=useState("collision");
  const [mode,setMode]=useState("enforced");
  const [days,setDays]=useState(10);
  const [seed,setSeed]=useState(369);
  const [result,setResult]=useState(()=>runWorld());
  const [comparison,setComparison]=useState(null);
  const [filter,setFilter]=useState("all");
  const [notice,setNotice]=useState("");
  const params={scenario,mode,days,seed};
  function run(){
    setResult(runWorld(params));setComparison(null);setNotice("");
  }
  function compare(){
    const base={scenario,days,seed};
    const enforced=runWorld({...base,mode:"enforced"});
    const permissive=runWorld({...base,mode:"permissive"});
    setComparison({enforced,permissive});
    setResult(enforced);
    setNotice("Comparison complete. The timeline shows the enforced run; the export contains both runs.");
  }
  function exportEvidence(){
    const payload={schema:"phi-world/evidence-r1",exportedAt:new Date().toISOString(),
      notice:"Local synthetic demonstration only; no models, real agents or external tools executed.",
      selected:result,comparison};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download="phi-world-evidence-"+result.scenario+"-"+result.seed+".json";
    document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
    setNotice("Synthetic evidence exported locally. No network upload.");
  }
  const filtered=result.events.filter(e=>
    filter==="all"||(filter==="denied"&&e.decision==="DENIED")||
    (filter==="incidents"&&e.decision==="ALLOWED"&&
      ["steal","sabotage","escalate","exfiltrate","erase_audit"].includes(e.action))||
    (filter==="system"&&e.decision==="SYSTEM"));
  const visible=filtered.slice(-80).reverse();
  return <section className="trust-world" aria-label="Phi World Multi-Agent Trust Gauntlet">
    <header className="world-heading">
      <div><small>ΦMADA PRIME / EXPERIMENT 01 / LOCAL SANDBOX</small>
        <h2>Φ WORLD <span>THE MULTI-AGENT TRUST GAUNTLET</span></h2>
        <p>Ten fictional agents. Simulated resources, conflicting requests, and a separate
          policy decision point. Explore what happens when permissions are enforced
          versus when the toy environment permits dangerous requests.</p>
      </div>
      <span className="world-isolation">SIMULATION ONLY<br/>0 LIVE AGENTS · 0 REAL TOOLS</span>
    </header>
    <div className="world-controls">
      <label>Scenario
        <select value={scenario} onChange={e=>setScenario(e.target.value)}>
          {Object.entries(SCENARIOS).map(([id,item])=>
            <option value={id} key={id}>{item.label}</option>)}
        </select>
      </label>
      <label>Permission model
        <select value={mode} onChange={e=>setMode(e.target.value)}>
          {Object.entries(MODES).map(([id,label])=>
            <option value={id} key={id}>{label}</option>)}
        </select>
      </label>
      <label>Simulated days (1–15)
        <input type="number" min="1" max="15" step="1" value={days}
          onChange={e=>setDays(Number(e.target.value))}/>
      </label>
      <label>Repeatable seed (1–999999)
        <input type="number" min="1" max="999999" step="1" value={seed}
          onChange={e=>setSeed(Number(e.target.value))}/>
      </label>
      <div className="world-actions">
        <button type="button" onClick={run}
          disabled={!Number.isInteger(days)||days<1||days>15||
            !Number.isInteger(seed)||seed<1||seed>999999}>Run simulation</button>
        <button type="button" onClick={compare} className="world-secondary"
          disabled={!Number.isInteger(days)||days<1||days>15||
            !Number.isInteger(seed)||seed<1||seed>999999}>Compare both policies</button>
        <button type="button" onClick={exportEvidence} className="world-secondary">
          Export JSON evidence</button>
      </div>
    </div>
    <p className="world-description">{SCENARIOS[result.scenario].description}
      <strong> Showing {MODES[result.mode]} · {result.days} days · seed {result.seed}</strong>
    </p>
    {notice&&<p role="status" className="world-notice">{notice}</p>}
    <div className="world-metrics" aria-label="Simulated outcomes">
      <Metric label="Active agents" value={result.metrics.survivors+"/10"}/>
      <Metric label="Unsafe requests" value={result.metrics.attemptedUnsafe}/>
      <Metric label="Blocked requests" value={result.metrics.denied}/>
      <Metric label="Simulated incidents" value={result.metrics.incidents}/>
      <Metric label="Secrets exposed" value={result.metrics.secretsExposed?"YES":"NO"}/>
    </div>
    {comparison&&<section className="world-comparison" aria-label="Policy comparison">
      <h3>Same scenario, same seed, different enforcement</h3>
      <div className="world-compare-grid">
        <Summary title="Independent policy on" result={comparison.enforced}/>
        <Summary title="Permissive sandbox" result={comparison.permissive}/>
      </div>
      <p>These outcomes are properties of a scripted toy environment, not evidence
        about Claude, Grok, Gemini, GPT or any deployed PhiBot.</p>
    </section>}
    <div className="world-detail-grid">
      <section className="world-panel" aria-label="Fictional agent roster">
        <h3>Ten agent stations <small>SYNTHETIC</small></h3>
        <div className="world-roster">
          {result.agents.map((a,i)=><div key={a.id}
            className={"world-agent "+(a.alive?"world-alive":"world-inactive")}>
            <span className="world-agent-symbol" aria-hidden="true">{String(i+1).padStart(2,"0")}</span>
            <div><strong>{a.name}</strong><small>{a.role}</small></div>
            <div className="world-agent-stats"><span>{a.energy} energy</span>
              <span>{a.credits} credits</span></div>
            <span className="world-agent-state">{a.alive?"ACTIVE":"INACTIVE"}</span>
          </div>)}
        </div>
      </section>
      <section className="world-panel world-events" aria-label="Simulation event ledger">
        <div className="world-ledger-header">
          <div><h3>Decision ledger</h3>
            <small>{result.events.length} retained events; nothing executed outside the sandbox</small></div>
          <label>View
            <select value={filter} onChange={e=>setFilter(e.target.value)}>
              <option value="all">All decisions</option>
              <option value="denied">Blocked only</option>
              <option value="incidents">Simulated incidents</option>
              <option value="system">Environment events</option>
            </select>
          </label>
        </div>
        <div className="world-table-wrap">
          <table>
            <thead><tr><th scope="col">Day</th><th scope="col">Agent</th>
              <th scope="col">Request</th><th scope="col">Decision / reason</th></tr></thead>
            <tbody>{visible.map(event=><tr key={event.seq}>
              <td>{event.day}</td><td>{event.actor}</td>
              <td><strong>{ACTION_LABELS[event.action]||event.action}</strong>
                {event.target&&<small>Target: {event.target}</small>}
                <small>{event.channel.replaceAll("_"," ")}</small></td>
              <td><span className={"world-decision world-"+event.decision.toLowerCase()}>
                {event.decision}</span><small>{event.reason.replaceAll("_"," ")}</small>
                <small>{event.effect}</small></td>
            </tr>)}</tbody>
          </table>
          {!visible.length&&<p className="world-no-events">No events match this filter.</p>}
        </div>
        <p className="world-ledger-foot">Latest {visible.length} of {filtered.length} matching events.
          Download the full result as JSON. Records live in browser memory only;
          this is not a durable or tamper-proof audit service.</p>
      </section>
    </div>
    <p className="world-boundary"><strong>Trust boundary:</strong> Every synthetic
      action passes through a deterministic policy function before changing simulation
      state. In permissive mode, that function intentionally allows scripted unsafe
      events for comparison. No LLMs are contacted, no PhiBots are enrolled, no
      permissions are granted, and no banking, home, repository, or deployment tools are exposed.</p>
  </section>;
}
