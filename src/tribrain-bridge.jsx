import React,{useRef,useState} from "react";
import {MAX_BYTES,inspectTriBrainText,triBrainReviewHandoff} from "./tribrain-bridge.mjs";
import "./tribrain-bridge.css";

export function TriBrainBridge({onOpenR36=()=>{},onOpenR37=()=>{}}){
  const input=useRef(null),seq=useRef(0);
  const [file,setFile]=useState(null),[report,setReport]=useState(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  function reset(clearInput=false){
    seq.current++;setFile(null);setReport(null);setBusy(false);setMessage("");
    if(clearInput&&input.current)input.current.value="";
  }
  async function inspect(){
    if(!file||busy)return;
    const generation=++seq.current;
    setBusy(true);setReport(null);setMessage("");
    try{
      if(file.size===0||file.size>MAX_BYTES)throw Error("R38_INPUT_SIZE");
      const result=await inspectTriBrainText(await file.text());
      if(generation===seq.current){
        if(result.valid)setReport(result);
        else setMessage(result.reason);
      }
    }catch{
      if(generation===seq.current)setMessage("File rejected. Use a bounded local PhiTriBrain Rung 4a JSON export.");
    }finally{
      if(generation===seq.current)setBusy(false);
    }
  }
  async function copy(){
    if(!report?.valid)return;
    try{
      if(!navigator.clipboard?.writeText)throw Error("NO_CLIPBOARD");
      await navigator.clipboard.writeText(triBrainReviewHandoff(report));
      setMessage("Only the bounded, non-sensitive review summary was copied.");
    }catch{setMessage("Clipboard unavailable. Nothing was copied.");}
  }
  const w=report?.lanes?.WITNESS||[];
  const r=report?.lanes?.WEAVER||[];
  const d=report?.lanes?.STEWARD||[];
  const byId=new Map(w.map(c=>[c.id,c]));
  return <section className="tribrain-room" aria-label="R38 PhiTriBrain Knowledge Bridge">
    <header className="tb-head">
      <small>R38 / ΦTRIBRAIN 369 × ΦMADA PRIME</small>
      <h3>Three brains. One accountable ledger.</h3>
      <p>Read a PhiTriBrain <strong>Rung 4a</strong> operator snapshot in your browser.
        WITNESS attributes source claims; WEAVER proposes relationships; STEWARD
        records decisions for human review. <strong>No automatic synchronization,
        model calls, uploads, permissions or execution.</strong></p>
    </header>
    <div className="tb-import">
      <div>
        <h4>Bring in a local TriBrain snapshot</h4>
        <p>In PhiTriBrain's local CLI, choose exact claim/relationship/decision IDs
          and export a Rung 4a JSON snapshot for consumer <code>PhiMadaPrime</code>.
          Inspect its contents for sensitive information before loading it here.</p>
        <pre>phitribrain bridge --manifest operator.json --output phi-operator-snapshot.json</pre>
      </div>
      <label>Local Rung 4a JSON snapshot (256 KiB maximum)
        <input type="file" ref={input} accept=".json,application/json"
          onChange={e=>{reset();setFile(e.target.files?.[0]||null);}}/>
      </label>
      <div className="tb-actions">
        <button type="button" disabled={!file||busy} onClick={inspect}>
          {busy?"Checking Python canonical SHA-256…":"Inspect three-brain snapshot"}
        </button>
        <button type="button" className="tb-clear" onClick={()=>reset(true)}>Clear local evidence</button>
      </div>
      {message&&<p className="tb-warning" role="status">{message}</p>}
      {!report&&!message&&<p className="tb-idle" role="status">
        {file?"File selected. Verification has not run.":"No snapshot loaded. All three lanes remain unverified."}
      </p>}
    </div>
    {report&&<div className="tb-result" role="status">
      <div className="tb-result-head">
        <h4>Snapshot structure &amp; digest consistent</h4>
        <span>UNSIGNED · UNAUTHENTICATED</span>
      </div>
      <p><strong>{report.scope}</strong> · Claimed snapshot time: <time>{report.asOf}</time></p>
      <p>Canonical SHA-256: <code className="tb-digest">{report.digest}</code></p>
      <p className="tb-warning">The digest can be recomputed by anyone editing this JSON.
        This check does NOT authenticate PhiTriBrain as the producer, check the underlying
        SQLite/source bytes, validate the factual claims, or prove that a model ran.</p>
      <div className="tb-lanes">
        <section className="tb-lane witness">
          <h4><span aria-hidden="true">◉</span> 01 · WITNESS <small>{w.length}</small></h4>
          <p>Verbatim attributed claims. A citation indicates what a source says, not that it is true.</p>
          {w.map(c=><article key={c.id} className="tb-record">
            <small>{c.id} · {c.recorded_state}</small>
            <strong>{c.statement}</strong>
            <blockquote>“{c.citation.quote}”</blockquote>
            <p>Source: {c.citation.source_title}</p>
            <p><code>{c.citation.source_id}</code> · lines {c.citation.line_start}–{c.citation.line_end}</p>
            <p>Source digest <code className="tb-digest">{c.citation.source_sha256}</code></p>
            <p>Last observed (claimed): {c.source_observed_at} · age {c.source_observation_age_days} days</p>
            <p>Valid-time annotation: {c.valid_time.kind} / {c.valid_time.status}</p>
            {c.citation.references.length>0&&<details>
              <summary>Original source references ({c.citation.references.length})</summary>
              {c.citation.references.map((ref,i)=><p key={i}>
                {ref.kind==="github_immutable_commit"?
                  <>{ref.repository} · {ref.path} @ {ref.commit}</>:
                  <>Vault {ref.vault_id} · {ref.path}</>}
              </p>)}
            </details>}
            {c.warnings.length>0&&<div className="tb-record-warning">
              {c.warnings.map((warning,i)=><p key={i}>{warning}</p>)}
            </div>}
          </article>)}
        </section>
        <section className="tb-lane weaver">
          <h4><span aria-hidden="true">◎</span> 02 · WEAVER <small>{r.length}</small></h4>
          <p>Suggested supports, contradicts and related links. No factual relationship is certified.</p>
          {r.length===0&&<p className="tb-empty">No explicitly selected relationships.</p>}
          {r.map(link=><article className="tb-record" key={link.id}>
            <small>{link.id} · {link.review_status}</small>
            <strong>{link.relation_proposed.toUpperCase()}</strong>
            <p><code>{link.left_claim}</code> ↔ <code>{link.right_claim}</code></p>
            <p>Left claim: {byId.get(link.left_claim)?.statement}</p>
            <p>Right claim: {byId.get(link.right_claim)?.statement}</p>
            <p>Proposed by: {link.method}</p>
            <p><strong>Factual truth: NOT VERIFIED</strong></p>
          </article>)}
        </section>
        <section className="tb-lane steward">
          <h4><span aria-hidden="true">⬡</span> 03 · STEWARD <small>{d.length}</small></h4>
          <p>Evidence-linked decisions. A locally approved review remains an annotation only.</p>
          {d.length===0&&<p className="tb-empty">No explicitly selected decisions.</p>}
          {d.map(dec=><article className="tb-record" key={dec.id}>
            <small>{dec.id} · local review: {dec.status}</small>
            <strong>{dec.title}</strong>
            <p>{dec.rationale}</p>
            <p>Evidence claims: {dec.evidence_claim_ids.join(", ")}</p>
            <p>Local credential checked: {dec.credential_checked?"reported yes":"reported no"}</p>
            <p>Review digest: {dec.review_attestation_digest||"none"}</p>
            <p><strong>Execution permission: NONE</strong></p>
          </article>)}
        </section>
      </div>
      <div className="tb-footer">
        <strong>Knowledge is not authorization.</strong>
        <p>All three lanes are an explicitly selected local point-in-time export.
          No evidence is linked cryptographically to R36 or R37. Permissions
          remain NONE even if a STEWARD review says approved.</p>
        <button type="button" onClick={copy}>Copy bounded review-only summary</button>
      </div>
    </div>}
    <div className="tb-links">
      <button type="button" onClick={onOpenR36}>R36 · Signed Evidence</button>
      <button type="button" onClick={onOpenR37}>R37 · Council Provenance</button>
      <a href="https://github.com/MichaelWave369/PhiTriBrain369/blob/main/docs/OPERATOR_BRIDGE.md"
        target="_blank" rel="noopener noreferrer">PhiTriBrain operator-bridge documentation</a>
    </div>
  </section>;
}
