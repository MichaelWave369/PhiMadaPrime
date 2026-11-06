import React,{useState} from "react";
import {SYNTHETIC_SCENARIOS,runSyntheticScenario} from "./verified-pipeline-simulator.mjs";
import "./verified-pipeline-simulator.css";

/** Explicit offline exercise. No network, tools, workers or real receipts. */
export function SyntheticGateLab({design}){
  const [scenario,setScenario]=useState("sample_pass");
  const [lastRun,setLastRun]=useState(null);
  const active=lastRun?.design===design&&lastRun?.scenario===scenario?
    lastRun.report:null;
  const selection=SYNTHETIC_SCENARIOS.find(x=>x.id===scenario);
  function run(){
    setLastRun({design,scenario,report:runSyntheticScenario(design,scenario)});
  }
  return <section className="vps-lab" aria-label="Offline synthetic verification gate laboratory">
    <header className="vps-heading">
      <div><small>R2 / SIMULATION ONLY / NO REAL CI</small>
        <h4>Verification Gate Lab</h4>
        <p>Attack the pipeline with deliberately incomplete or misleading
          <strong> synthetic test receipts</strong>. Nothing is executed.</p>
      </div>
      <span className="vps-stamp">SYNTHETIC · NOT VERIFIED</span>
    </header>
    <div className="vps-pick">
      <label htmlFor="vps-scenario">Select a synthetic failure or success case
        <select id="vps-scenario" value={scenario} onChange={event=>{
          setScenario(event.target.value);setLastRun(null);
        }}>
          {SYNTHETIC_SCENARIOS.map(item=>
            <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <button type="button" onClick={run}>Run offline simulation</button>
      <p className="vps-description">{selection?.detail}</p>
    </div>
    {!active&&<div className="vps-empty" role="status">
      No current scenario evaluation. Select a case and run the offline gate.
      Changing the pipeline requires a fresh evaluation.
    </div>}
    {active&&<div className="vps-results" aria-live="polite">
      <div className="vps-verdict">
        <div>
          <small>MODE: {active.mode}</small>
          <strong>{active.state.replaceAll("_"," ")}</strong>
          <span>{active.synthetic_gate_accepted?
            "This built-in fixture satisfies the simulated policy checks only.":
            "The simulated policy held the receipt or pipeline."}</span>
        </div>
        <span className={active.synthetic_gate_accepted?"vps-accept":"vps-reject"}>
          {active.synthetic_gate_accepted?"SYNTHETIC ACCEPT":"SYNTHETIC HELD"}
        </span>
      </div>
      <div className="vps-checks">
        {active.checks.map(check=><div key={check.id} className="vps-check">
          <span aria-hidden="true">{check.ok?"✓":"×"}</span>
          <div><strong>{check.label}</strong>
            <small>{check.explanation}</small></div>
          <b>{check.ok?"MATCH":"HELD"}</b>
        </div>)}
      </div>
      {active.issues.length>0&&<div className="vps-issues">
        <strong>Why the gate held</strong>
        <ul>{active.issues.map((issue,index)=><li key={index}>{issue}</li>)}</ul>
      </div>}
      <div className="vps-truth">
        <strong>REAL-WORLD VERIFICATION: NOT PERFORMED</strong>
        <span>Actual tests executed here: NO</span>
        <span>GitHub CI checked here: NO</span>
        <span>External source authenticated: NO</span>
        <span>Human approval recorded: NO</span>
        <span>Merge, deployment or worker permission: NONE</span>
      </div>
    </div>}
    <p className="vps-notice">
      SYNTHETIC EXERCISE ONLY. Even a simulated acceptance is not a real
      test receipt, GMED verification, human authorization, or factual proof.
    </p>
  </section>;
}
