import React, {useRef, useState} from "react";
import {MAX_SIGNED_BYTES, MAX_TRUST_BYTES, verifyR10Evidence} from "./vessel-evidence.mjs";
import "./vessel-evidence.css";

const NONE="NONE";
async function parseFile(file,max) {
  if(!file || file.size<1 || file.size>max) throw Error("MISSING_OR_OVERSIZED_INPUT");
  return JSON.parse(await file.text());
}
export function VesselEvidence({onReportChange=()=>{}}) {
  const signedInput=useRef(null), trustInput=useRef(null), latest=useRef(0);
  const [signed,setSigned]=useState(null), [trust,setTrust]=useState(null);
  const [report,setReport]=useState(null), [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  function invalidate() { latest.current++; setReport(null); onReportChange(null); setError(""); setBusy(false); }
  function clear() {
    invalidate(); setSigned(null); setTrust(null); setBusy(false);
    if(signedInput.current) signedInput.current.value="";
    if(trustInput.current) trustInput.current.value="";
  }
  async function inspect() {
    if(busy || !signed) return;
    const run=++latest.current;
    setBusy(true);setReport(null);setError("");
    try {
      const [envelope,pins]=await Promise.all([
        parseFile(signed,MAX_SIGNED_BYTES),
        trust ? parseFile(trust,MAX_TRUST_BYTES) : Promise.resolve(null)
      ]);
      const outcome=await verifyR10Evidence(envelope,pins);
      if(run===latest.current) { setReport(outcome); onReportChange(outcome); }
    } catch {
      if(run===latest.current) setError("Evidence refused: invalid, unreadable or oversized JSON. No authority granted.");
    } finally {
      if(run===latest.current) setBusy(false);
    }
  }
  return <section className="vessel-evidence" aria-label="R36 Vessel Evidence Bridge">
    <div className="ve-heading">
      <small>R36 / SUPER Φ.VESSEL × ΦMADA PRIME</small>
      <h3>Vessel Evidence & Trust</h3>
      <p>Local-only inspection of PhiLearn/SuperPhiVessel's R8 synthetic Skill Passport
        and optional R10 operator-pinned Ed25519 signature. <strong>No data is uploaded.
        No model is invoked. Nothing is approved or dispatched.</strong></p>
    </div>
    <div className="ve-steps">
      <label>1 · R10 signed Skill Passport JSON (max 320 KB)
        <input ref={signedInput} type="file" accept=".json,application/json"
          onChange={e=>{invalidate();setSigned(e.target.files?.[0]||null);}}/>
      </label>
      <label>2 · Independently operator-pinned R10 trust store (optional, max 16 KB)
        <input ref={trustInput} type="file" accept=".json,application/json"
          onChange={e=>{invalidate();setTrust(e.target.files?.[0]||null);}}/>
      </label>
    </div>
    <p className="ve-note">The public key must be authenticated independently before import.
      A key supplied alongside the envelope by its sender is <strong>not</strong> independent trust.
      Without trusted pins, only synthetic replay consistency can be checked.</p>
    <div className="ve-actions">
      <button type="button" disabled={!signed||busy} onClick={inspect}>
        {busy?"Verifying locally…":"Inspect evidence"}
      </button>
      <button type="button" className="ve-clear" onClick={clear}>Clear files & result</button>
    </div>
    {error&&<p className="ve-warning" role="alert">{error}</p>}
    {!report&&!error&&<p className="ve-empty" role="status">
      {signed?"Ready for explicit local inspection.":"No evidence selected. All verification states are unknown."}
    </p>}
    {report&&<div className="ve-report" role="status">
      <h4>R10 verification · {report.status.replaceAll("_"," ")}</h4>
      <p>{report.reason}</p>
      <dl>
        <div><dt>R8 synthetic replay</dt><dd>{report.sourceReplayConsistent?"CONSISTENT":"NOT VERIFIED"}</dd></div>
        <div><dt>Issuer key pinned</dt><dd>{report.keyPinned?"MATCHED":"NOT VERIFIED"}</dd></div>
        <div><dt>Ed25519 signature</dt><dd>{report.signatureValid?"VERIFIED":"NOT VERIFIED"}</dd></div>
        <div><dt>R11 inspection enrollment</dt><dd>NOT EVALUATED</dd></div>
        <div><dt>R12 signed event chain</dt><dd>NOT EVALUATED</dd></div>
        <div><dt>R13 witness checkpoint</dt><dd>NOT EVALUATED</dd></div>
        <div><dt>AI model execution proven</dt><dd>NO</dd></div>
        <div><dt>Operational authority</dt><dd>{NONE}</dd></div>
      </dl>
      {report.signatureValid&&<p className="ve-foot">
        Claimed model: <strong>{report.model}</strong> · Issuer: <strong>{report.issuerId}</strong>.
        These are signed labels, not independently proved model/provider identity.
      </p>}
    </div>}
    <div className="ve-boundary">
      <h4>Integration boundary</h4>
      <p>This R36 verifier ports the exact R6 synthetic replay, R7/R8 SHA-256 checks,
        and R10 Ed25519 signature message from Vessie's offline protocol into browser
        Web Crypto. R11 enrollment, R12 governance event chains and R13 independent
        witness validation must still use their original <strong>offline Vessie verifiers</strong>.
        Their presence in a JSON file alone is never evidence of validity.</p>
      <p>R36 does not verify real inference, a FlashProve zk proof, actual AI agent identity,
        a GitHub run, a deployed service, or software completion. Nothing is persisted
        to localStorage, sent to Agentora, or used to change a ThinkTank role.</p>
      <a href="https://github.com/MichaelWave369/SuperPhiVessel/tree/main/interop"
        target="_blank" rel="noopener noreferrer">Inspect canonical SuperPhiVessel protocols</a>
    </div>
  </section>;
}
