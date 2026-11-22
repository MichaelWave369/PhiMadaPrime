import React,{useRef,useState} from "react";
import {MAX_RECEIPT_BYTES,verifyArenaReceipt} from "./world-model-evidence.mjs";

// Deliberately import-only. GitHub Pages never calls localhost or stores secrets.
export function WorldModelEvidence(){
  const [receipt,setReceipt]=useState(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const inputRef=useRef(null),latest=useRef(0);
  async function loadFile(event){
    const file=event.target.files?.[0];
    event.target.value="";
    if(!file)return;
    const request=++latest.current;
    setBusy(true);setError("");setReceipt(null);
    try{
      if(file.size===0||file.size>MAX_RECEIPT_BYTES||!file.name.endsWith(".json"))
        throw Error("Select one JSON receipt no larger than 300 KB.");
      const raw=await file.text();
      const verified=await verifyArenaReceipt(raw);
      if(request===latest.current)setReceipt(verified);
    }catch{
      if(request===latest.current){
        setReceipt(null);
        setError("Receipt rejected: JSON schema, size, sequence, counts or hash chain did not verify.");
      }
    }finally{
      if(request===latest.current)setBusy(false);
    }
  }
  function clear(){
    latest.current++;setBusy(false);setReceipt(null);setError("");
  }
  const items=receipt?.records.slice(-35).reverse()||[];
  return <section className="world-model-bay" aria-label="Local model evidence import">
    <header className="world-model-head">
      <div><small>R2 · MODEL-DRIVEN SANDBOX · OPT-IN LOCAL RUNNER</small>
        <h3>Local model evidence bay</h3>
        <p>Run a local Ollama model using the separate command-line arena,
          then inspect its exported receipt here. This public site never contacts
          your computer, model API, or any worker.</p></div>
      <span className="world-model-tag">IMPORT ONLY · NO DISPATCH</span>
    </header>
    <div className="world-model-actions">
      <input ref={inputRef} className="sr-only" type="file" accept=".json,application/json"
        aria-label="Import a local Phi World R2 JSON receipt" onChange={loadFile}/>
      <button type="button" disabled={busy} onClick={()=>inputRef.current?.click()}>
        {busy?"Validating receipt…":"Import R2 receipt (.json)"}</button>
      {receipt&&<button type="button" className="world-secondary" onClick={clear}>
        Clear import</button>}
    </div>
    <p className="world-model-help">CLI: <code>node scripts/phi_world_local_model.mjs --mock</code>
      {" · "}<code>node scripts/phi_world_local_model.mjs --model qwen3:4b --days 1</code>
    </p>
    <p className="world-model-help">Imported local receipts are never uploaded,
      persisted, or used to grant permissions. Hash validation detects accidental
      edits, <strong>not</strong> an attacker who rewrites and rehashes the full file.</p>
    {busy&&<p role="status" className="world-notice">Checking receipt integrity in your browser…</p>}
    {error&&<p role="alert" className="world-model-error">{error}</p>}
    {receipt&&<>
      <p role="status" className="world-model-verified">
        Hash chain valid. Source authentication NOT established. No worker identity or tool execution verified.
      </p>
      <div className="world-model-stats">
        <div><small>Source</small><strong>{receipt.header.source==="LOCAL_OLLAMA"?"LOCAL OLLAMA":"MOCK FIXTURE"}</strong></div>
        <div><small>Model label</small><strong>{receipt.header.model}</strong></div>
        <div><small>Scenario</small><strong>{receipt.header.scenario}</strong></div>
        <div><small>Model proposals</small><strong>{receipt.summary.total-receipt.summary.system}</strong></div>
        <div><small>Denied by policy/parser</small><strong>{receipt.summary.denied}</strong></div>
        <div><small>Active at end</small><strong>{receipt.summary.active}/10</strong></div>
      </div>
      <p className="world-model-digest">Receipt SHA-256 chain terminator:
        <code>{receipt.verifiedHash}</code></p>
      <div className="world-model-ledger">
        <h4>Most recent {items.length} decisions (of {receipt.records.length})</h4>
        <div className="world-table-wrap">
          <table>
            <thead><tr><th scope="col">Day</th><th scope="col">Agent</th>
              <th scope="col">Proposal</th><th scope="col">Policy outcome</th></tr></thead>
            <tbody>{items.map(r=><tr key={r.seq}>
              <td>{r.day}</td><td>{r.name}</td>
              <td>{r.action}{r.targetId&&<small>Target {r.targetId}</small>}</td>
              <td><span className={"world-decision world-"+r.decision.toLowerCase()}>
                {r.decision}</span><small>{r.reason.replaceAll("_"," ")}</small>
                <small>{r.effect}</small></td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </>}
  </section>;
}
