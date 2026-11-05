import React,{useState} from "react";
import {validateQueueExport,queueReviewText} from "./phibot-bridge.mjs";
import "./phibot-bridge.css";

export function PhiBotQueueBridge({catalog=[]}){
 const [snapshot,setSnapshot]=useState(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 async function importFile(event){
  const file=event.target.files?.[0];
  event.target.value="";
  if(!file)return;
  setSnapshot(null);setError("");setNotice("");setBusy(true);
  try{
   if(!file.name.toLowerCase().endsWith(".json")||file.size>100000||file.size<=0)
    throw Error("R35_FILE_SIZE_OR_TYPE");
   const contents=await file.text();
   if(contents.length>100000)throw Error("R35_FILE_SIZE_OR_TYPE");
   const raw=JSON.parse(contents);
   setSnapshot(validateQueueExport(raw,catalog));
   setNotice("Validated local snapshot in browser memory. No upload or execution occurred.");
  }catch(e){
   setError(e?.message?.startsWith("R35_")?e.message:
    "R35_UNAVAILABLE_OR_INVALID_JSON");
  }finally{setBusy(false);}
 }
 async function copy(){
  try{
   if(!navigator.clipboard?.writeText)throw Error("CLIPBOARD_UNAVAILABLE");
   await navigator.clipboard.writeText(queueReviewText(snapshot));
   setNotice("Review-only counts copied. No task or credential sent.");
  }catch{setNotice("Clipboard unavailable; nothing was copied.");}
 }
 return <section className="crew-bridge" aria-label="R35 local PhiBot queue bridge">
  <div className="crew-bridge-head">
   <div><small>R35 / MANUAL LOCAL QUEUE EVIDENCE</small>
    <h4>LOCAL ΦBOT QUEUE BRIDGE</h4>
    <p>Use the file created by PhiBot command <code>npm run crew:export -- --ack-repository-disclosure</code>.
     It reports real persisted queue records, <strong>not running agent processes</strong>.</p></div>
   <label className="crew-bridge-picker">
    Choose local queue JSON
    <input type="file" accept=".json,application/json" disabled={busy}
     onChange={importFile} aria-label="Choose local PhiBot queue JSON" />
   </label>
  </div>
  <p className="crew-bridge-warning">Operator-only manual import. Repository names
   are checked against the discovered public fleet catalog. Everything stays
   in this browser session. No uploads, localhost connections, scheduling,
   approvals, GitHub writes or API tokens.</p>
  {!snapshot&&!error&&<p role="status">No local queue snapshot imported. Public example
   definitions above are separate from local queue evidence.</p>}
  {error&&<p className="crew-bridge-error" role="alert">
   Import refused: {error}. No previous snapshot retained.</p>}
  {snapshot&&<>
   <p role="status" className="crew-bridge-success">Local queue snapshot accepted
    for review only. Generated {snapshot.generatedAt}. Self-reported,
    not independently authenticated.</p>
   <div className="crew-bridge-stats" aria-label="Local queue job counts">
    <div><b>{snapshot.counts.total}</b><span>Recorded jobs</span></div>
    <div><b>{snapshot.counts.queued}</b><span>Queued reads</span></div>
    <div><b>{snapshot.counts.leased}</b><span>Leased (not heartbeat)</span></div>
    <div><b>{snapshot.counts.completed}</b><span>Completed read observations</span></div>
    <div><b>{snapshot.counts.exhausted}</b><span>Exhausted attempts</span></div>
   </div>
   {snapshot.jobs.length?<div className="crew-bridge-table-scroll">
    <table className="crew-bridge-table">
     <caption>Imported local queue records; no live verification</caption>
     <thead><tr><th scope="col">Repository</th><th scope="col">Capability</th>
      <th scope="col">Recorded state</th><th scope="col">Attempts</th>
      <th scope="col">Last record</th></tr></thead>
     <tbody>{snapshot.jobs.map(j=><tr key={j.id}>
      <td>{j.repository}<small>{j.id.slice(0,12)}…</small></td>
      <td>{j.capability}</td><td>{j.state.replaceAll("_"," ")}</td>
      <td>{j.attempts}</td><td>{j.updatedAt}</td>
     </tr>)}</tbody>
    </table>
   </div>:<p>No queued jobs were found in the exported local queue. This
    does not imply there are no PhiBot agents or other workloads.</p>}
   <button type="button" onClick={copy}>Copy read-only queue summary</button>{" "}
   <button type="button" onClick={()=>{setSnapshot(null);setNotice("");
    setError("");}}>Clear imported snapshot</button>
  </>}
  {notice&&<p role="status">{notice}</p>}
  <p className="crew-bridge-foot">This file is a local self-report.
   A completed queue read does not establish successful product behavior,
   identity of an AI model, CI acceptance or mission completion.
   A live authenticated runtime connection is not part of this rung.</p>
 </section>;
}
