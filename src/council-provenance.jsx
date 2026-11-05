import React,{useEffect,useMemo,useRef,useState} from "react";
import {
  COUNCIL_SEATS,councilProvenanceSnapshot,councilProvenanceHandoff,
  verifyAgentoraCouncilEvidence
} from "./council-provenance.mjs";
import "./council-provenance.css";

const SHA=/^[a-f0-9]{40}$/;
const PR=/^[1-9]\d{0,8}$/;

export function CouncilProvenance({r36Report=null,onOpenR36=()=>{}}){
  const [seatId,setSeatId]=useState("vessie");
  const [pr,setPr]=useState("");
  const [sha,setSha]=useState("");
  const [record,setRecord]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const generation=useRef(0);
  useEffect(()=>()=>{generation.current++;},[]);
  const review=useMemo(()=>councilProvenanceSnapshot(seatId,r36Report,record),
    [seatId,r36Report,record]);
  function clearRun(){
    generation.current++;
    setRecord(null);setBusy(false);setError("");setNotice("");
  }
  async function inspect(){
    if(busy||!PR.test(pr)||!SHA.test(sha))return;
    const seq=++generation.current;
    setBusy(true);setError("");setRecord(null);setNotice("");
    try{
      // Uses the existing Agentora R1 reader, never a submitted/self-signed receipt.
      const result=await verifyAgentoraCouncilEvidence(pr,sha);
      if(seq===generation.current)setRecord(result);
    }catch(cause){
      if(seq===generation.current) {
        const value=typeof cause?.message==="string" && /^(R37|TURN)_[A-Z0-9_]+$/.test(cause.message)
          ?cause.message:"R37_GITHUB_EVIDENCE_UNAVAILABLE";
        setError(value);
      }
    }finally{
      if(seq===generation.current)setBusy(false);
    }
  }
  async function copy(){
    try{
      if(!navigator.clipboard?.writeText)throw Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(councilProvenanceHandoff(review));
      setNotice("Categorical review handoff copied. No action was sent.");
    }catch{
      setNotice("Copy unavailable. No evidence or authorization was sent.");
    }
  }
  return <section className="council-provenance" aria-label="R37 Council Provenance">
    <header className="cp-head">
      <small>R37 / THINKTANK · COUNCIL PROVENANCE</small>
      <h3>Trust is a record, not a role</h3>
      <p>Inspect a verified <strong>synthetic R10 Skill Passport</strong> alongside a
        separately corroborated <strong>Agentora R1 GitHub execution record</strong>.
        Neither source establishes which named ThinkTank persona or model actually
        participated. No cryptographic link exists between these two protocols.</p>
    </header>
    <div className="cp-layout">
      <div className="cp-panel">
        <h4>1 · Choose a council seat for review</h4>
        <label>Role blueprint (operator-selected, never authenticated)
          <select value={seatId} onChange={e=>{setSeatId(e.target.value);setNotice("");}}>
            <optgroup label="Primary operators">
              {COUNCIL_SEATS.filter(s=>s.team==="PRIMARY_OPERATORS").map(s=>
                <option value={s.id} key={s.id}>{s.name} · {s.role}</option>)}
            </optgroup>
            <optgroup label="Ori Council">
              {COUNCIL_SEATS.filter(s=>s.team==="ORI_COUNCIL").map(s=>
                <option value={s.id} key={s.id}>{s.name} · {s.role}</option>)}
            </optgroup>
          </select>
        </label>
        <p className="cp-fact"><strong>{review.selectedCouncilSeat.name}</strong> · {review.selectedCouncilSeat.role}</p>
        <p className="cp-note">Selecting a persona organizes this human review only.
          It is not a cryptographic agent identity, live session, approval, or task assignment.</p>
      </div>
      <div className="cp-panel">
        <h4>2 · Vessie's R36 signed evidence</h4>
        <div className="cp-state"><b>{review.r10.category.replaceAll("_"," ")}</b></div>
        {review.r10.category==="R10_PINNED_SYNTHETIC_PASSPORT"?
          <p className="cp-note">Pinned Ed25519 signature and six synthetic traces checked.
            Signed label: <strong>{review.r10.modelLabel}</strong>.
            That label does not prove a real model ran.</p>:
          <p className="cp-note">No valid pinned R10 signature was carried from
            the R36 room in this ThinkTank session.</p>}
        <button type="button" onClick={onOpenR36}>Open R36 Evidence &amp; Trust</button>
      </div>
    </div>
    <div className="cp-panel cp-agentora">
      <h4>3 · Independently verify a GitHub Agentora R1 output</h4>
      <p>This uses R31's existing <strong>trusted Agentora R1 reader</strong>:
        the fixed public repository, owner environment approval, controller run,
        task digest, required CI checks and merge readback. Enter an actual R1
        PR and its exact tested-head or merge SHA. No arbitrary repository URL is accepted.</p>
      <div className="cp-fields">
        <label>Agentora R1 pull request number
          <input type="text" inputMode="numeric" maxLength={9} value={pr}
            placeholder="R1 PR number" onChange={e=>{clearRun();setPr(e.target.value);}}/>
        </label>
        <label>Expected R1 output commit SHA (40 lowercase hex characters)
          <input type="text" spellCheck={false} autoComplete="off" maxLength={40}
            value={sha} placeholder="Full tested PR head or merge SHA"
            onChange={e=>{clearRun();setSha(e.target.value.trim());}}/>
        </label>
      </div>
      <div className="cp-actions">
        <button type="button" disabled={busy||!PR.test(pr)||!SHA.test(sha)}
          onClick={inspect}>{busy?"Checking exact GitHub records…":"Verify R1 output"}</button>
        <button type="button" className="cp-secondary"
          onClick={()=>{clearRun();setPr("");setSha("");}}>Clear R1 review</button>
      </div>
      {error&&<p className="cp-error" role="alert">HELD: <code>{error}</code>.
        Missing, changed, mismatched or unavailable GitHub evidence is not accepted.</p>}
      {record&&<div className="cp-result" role="status">
        <strong>GitHub R1 output corroborated</strong>
        <p>Output relation: {record.relation.replaceAll("_"," ")}</p>
        <p>Task <code>{record.taskId}</code> · output <code>{record.observedOutputSha}</code></p>
        <p><a href={record.prUrl} target="_blank" rel="noopener noreferrer">Original R1 PR</a>
          {" · "}<a href={record.runUrl} target="_blank" rel="noopener noreferrer">GitHub controller run</a></p>
        <p>Named CI checks: {record.checks.map(c=>c.name).join(", ")}.
          Remaining human acceptance items: {record.humanAcceptanceOutstanding}.</p>
        <p>Worker provenance does not authenticate an AI model, prove neural inference,
          or establish a connection to the R10 passport above.</p>
      </div>}
      {!record&&!error&&<p className="cp-note">No live GitHub R1 output is currently correlated in this room.</p>}
    </div>
    <div className="cp-panel cp-conclusion">
      <h4>4 · Combined evidence review</h4>
      <div className="cp-grid">
        <div><small>Selected seat</small><b>NOT AUTHENTICATED</b></div>
        <div><small>Vessie signed synthetic evidence</small><b>{review.r10.category==="R10_PINNED_SYNTHETIC_PASSPORT"?"R10 SIGNATURE VALID":"NOT VERIFIED"}</b></div>
        <div><small>Agentora R1 output</small><b>{record?"GITHUB CORRELATED":"NOT CORRELATED"}</b></div>
        <div><small>R10 ↔ Agentora shared provenance</small><b>NOT ESTABLISHED</b></div>
        <div><small>AI-model inference / agent identity</small><b>NOT PROVEN</b></div>
        <div><small>Authorization, dispatch or merge power</small><b>NONE</b></div>
      </div>
      <p className="cp-note">A legitimate signature and a legitimate GitHub R1 run
        can coexist without having anything to do with each other. This room
        deliberately keeps them independent until a future producer-authenticated,
        source-bound cross-runtime protocol exists.</p>
      <button type="button" onClick={copy}>Copy bounded review-only handoff</button>
      {notice&&<p className="cp-note" role="status">{notice}</p>}
    </div>
  </section>;
}
