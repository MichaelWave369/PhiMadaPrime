import React,{useState} from "react";
import {SOURCE,EXAMPLES,loadExamples,reviewHandoff} from "./phibot-crew.mjs";
import "./phibot-crew.css";
import {PhiBotQueueBridge} from "./phibot-bridge.jsx";
const authority=x=>x==="gated"?"GATED (DECLARED)":x?"YES (DECLARED)":"NO (DECLARED)";
export function PhiBotCrewDeck({catalog=[]}){
 const [snapshot,setSnapshot]=useState(null),[busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 async function inspect(){
  setBusy(true);setNotice("");
  try{setSnapshot(await loadExamples());}
  catch{setSnapshot(null);setNotice("Unable to inspect public manifests; no bots were contacted.");}
  finally{setBusy(false);}
 }
 async function copy(m){
  try{
   if(!navigator.clipboard?.writeText)throw Error("CLIPBOARD_UNAVAILABLE");
   await navigator.clipboard.writeText(reviewHandoff(m));
   setNotice("Review-only handoff copied. No work dispatched.");
  }catch{setNotice("Clipboard unavailable; no data was sent.");}
 }
 return <section className="crew-deck" aria-label="PhiBot Crew Deck">
  <div className="crew-intro">
   <div><small>R34 / PHIMADA PRIME × PHIBOT</small><h3>ΦBOT CREW DECK</h3>
    <p>Five real, immutable public PhiBot example manifests. <strong>Not</strong> verified
     installed, online or executing agents.</p></div>
   <button type="button" disabled={busy} onClick={inspect}>
    {busy?"Inspecting pinned manifests…":snapshot?"Refresh public definitions":"Inspect published crew"}
   </button>
  </div>
  <div className="crew-metrics" aria-label="Crew scope and evidence">
   <div><b>{snapshot?snapshot.loaded:"—"}</b><span>Definitions loaded</span></div>
   <div><b>0</b><span>Running workers verified</span></div>
   <div><b>0</b><span>Missions dispatched here</span></div>
   <div><b>0</b><span>Authority grants issued</span></div>
  </div>
  <p className="crew-source">Public source: <a target="_blank" rel="noopener noreferrer"
   href={"https://github.com/"+SOURCE.repo+"/tree/"+SOURCE.sha+"/bots/examples"}>
   PhiBot example manifests</a> · pinned commit <code>{SOURCE.sha.slice(0,12)}</code> ·
   unauthenticated, user-triggered reads only</p>
  {!snapshot&&<p role="status" className="crew-message">
   {busy?"Loading five allowlisted example files…":"No manifests inspected yet. This page does not connect to local PhiBot."}
  </p>}
  {snapshot&&<>
   <p className="crew-message" role="status">{snapshot.loaded} of {EXAMPLES.length} published
    definitions loaded.{snapshot.unavailable?" Partial results; unavailable files are not claimed as offline agents.":""}</p>
   <div className="crew-grid">
    {snapshot.entries.map(item=>item.ok?<article className="crew-card" key={item.file}>
     <small>PUBLISHED EXAMPLE · RUNTIME NOT OBSERVED</small>
     <h4>{item.manifest.name}</h4>
     <p className="crew-role">{item.manifest.role.replaceAll("_"," ")} · v{item.manifest.version}</p>
     <p>{item.manifest.description}</p>
     <dl>
      <div><dt>Model declared</dt><dd>{item.manifest.provider} / {item.manifest.model}</dd></div>
      <div><dt>Read / propose</dt><dd>{authority(item.manifest.declaredAuthority.read)} /
       {" "+authority(item.manifest.declaredAuthority.propose)}</dd></div>
      <div><dt>Write / deploy</dt><dd>{authority(item.manifest.declaredAuthority.write)} /
       {" "+authority(item.manifest.declaredAuthority.deploy)}</dd></div>
      <div><dt>Memory declared</dt><dd>{item.manifest.memoryScope} · depth {item.manifest.memoryDepth}</dd></div>
     </dl>
     <details><summary>Declared tools ({item.manifest.capabilities.length})</summary>
      <ul>{item.manifest.capabilities.map(c=><li key={c}><code>{c}</code></li>)}</ul>
      <p>Declaration is not an installed tool, effective permission or grant.</p>
     </details>
     <div className="crew-actions">
      <a target="_blank" rel="noopener noreferrer" href={item.manifest.sourceUrl}>View pinned source</a>
      <button type="button" onClick={()=>copy(item.manifest)}>Copy review handoff</button>
     </div>
    </article>:<article className="crew-card crew-error" key={item.file}>
     <h4>{item.file}</h4><p>UNAVAILABLE · {item.error}. No cached or invented bot status.</p>
    </article>)}
   </div>
  </>}
  {notice&&<p role="status" className="crew-message">{notice}</p>}
  <PhiBotQueueBridge catalog={catalog} />
  <footer><strong>REALITY GATE NOT CONNECTED</strong>
   <p>This public Pages view never runs a model, checks localhost, loads credentials,
    registers agents, schedules work, creates grants, modifies GitHub or claims verified execution.
    Authenticated local runtime integration is a separate future rung.</p>
  </footer>
 </section>;
}
