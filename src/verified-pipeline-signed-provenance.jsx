import React,{useEffect,useRef,useState} from "react";
import {SIGNED_PROVENANCE_LIMIT,PIN_STORE_LIMIT,verifySignedGmedProvenance}
  from "./verified-pipeline-signed-provenance.mjs";
import "./verified-pipeline-signed-provenance.css";

/** Browser-local verification only. No signer, no issuer keys, no approvals. */
export function SignedProvenanceGate({reportRaw=null}){
  const [signed,setSigned]=useState(null),[pins,setPins]=useState(null);
  const [confirmed,setConfirmed]=useState(false);
  const [result,setResult]=useState(null),[busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const signatureInput=useRef(null),pinsInput=useRef(null),attempt=useRef(0);
  const selectedReceipt=useRef(reportRaw);
  selectedReceipt.current=reportRaw;
  useEffect(()=>{
    ++attempt.current;
    setSigned(null);setPins(null);setConfirmed(false);
    setResult(null);setBusy(false);setError("");
    if(signatureInput.current)signatureInput.current.value="";
    if(pinsInput.current)pinsInput.current.value="";
  },[reportRaw]);
  function invalidate(){
    ++attempt.current;setResult(null);setBusy(false);setError("");
  }
  function clear(){
    invalidate();setSigned(null);setPins(null);setConfirmed(false);
    if(signatureInput.current)signatureInput.current.value="";
    if(pinsInput.current)pinsInput.current.value="";
  }
  async function inspect(){
    if(!reportRaw||!signed||busy)return;
    const i=++attempt.current,current=reportRaw;
    setBusy(true);setResult(null);setError("");
    try{
      if(signed.size<1||signed.size>SIGNED_PROVENANCE_LIMIT)
        throw Error("Signed envelope exceeds 192 KiB");
      if(pins&&(pins.size<1||pins.size>PIN_STORE_LIMIT))
        throw Error("Operator pin store exceeds 16 KiB");
      const [envelope,pinStore]=await Promise.all([
        signed.text(),pins?pins.text():Promise.resolve(null)
      ]);
      const inspected=await verifySignedGmedProvenance(current,envelope,pinStore,{
        operatorConfirmedIndependentPin:confirmed
      });
      if(i===attempt.current&&current===selectedReceipt.current)
        setResult({receipt:current,data:inspected});
    }catch(e){
      if(i===attempt.current&&current===selectedReceipt.current)
        setError(e instanceof Error?e.message:"Could not parse signed provenance");
    }finally{
      if(i===attempt.current&&current===selectedReceipt.current)setBusy(false);
    }
  }
  const shown=result?.receipt===reportRaw?result.data:null;
  return <section className="vpsig-root" aria-label="Signed provenance verification desk">
    <header>
      <div><small>R45 / LOCAL ED25519 / NO TRUSTED ISSUERS BUILT IN</small>
        <h5>Signed provenance gate</h5>
        <p>Check an Ed25519 signature against the exact bytes of your imported
          GMED report. This is separate from GitHub's live second opinion.</p>
      </div>
      <strong>KEY SIGNATURE ≠ ISSUER IDENTITY</strong>
    </header>
    <div className="vpsig-fields">
      <label>Signed claim envelope JSON
        <input ref={signatureInput} type="file" accept=".json,application/json"
          onChange={e=>{invalidate();setSigned(e.target.files?.[0]||null);}}/>
        <small>A detached signed claim binds the SHA-256 of the GMED receipt's exact bytes.</small>
      </label>
      <label>Separately obtained operator public-key pins (optional)
        <input ref={pinsInput} type="file" accept=".json,application/json"
          onChange={e=>{invalidate();setPins(e.target.files?.[0]||null);setConfirmed(false);}}/>
        <small>Never trust a pin store just because the sender enclosed it.</small>
      </label>
    </div>
    <label className="vpsig-confirm">
      <input type="checkbox" checked={confirmed} disabled={!pins}
        onChange={e=>{invalidate();setConfirmed(e.target.checked);}}/>
      I checked the issuer public-key fingerprint through an independent trusted channel.
      This is my declaration, not proof to the app.
    </label>
    <div className="vpsig-actions">
      <button type="button" onClick={inspect} disabled={!reportRaw||!signed||busy}>
        {busy?"Checking signature locally…":"Inspect signed provenance"}
      </button>
      <button type="button" onClick={clear}>Clear signature files and result</button>
    </div>
    {!reportRaw&&<p className="vpsig-note">Import a GMED v1 report above before inspecting its signature.</p>}
    {!shown&&reportRaw&&!busy&&<p className="vpsig-note">
      No signature checked for this receipt. No trusted issuer keys ship with this app.
    </p>}
    {error&&<p role="alert" className="vpsig-error">{error}</p>}
    {shown&&<div className="vpsig-result" role="status">
      <strong>{shown.status.replaceAll("_"," ")}</strong>
      <dl>
        <div><dt>Exact imported report digest matched</dt><dd>{shown.report_bytes_matched?"YES":"NO"}</dd></div>
        <div><dt>Ed25519 signature mathematically valid</dt><dd>{shown.signature_math_valid?"YES":"NO"}</dd></div>
        <div><dt>Operator key pin matched</dt><dd>{shown.operator_pin_matched?"YES":"NO"}</dd></div>
        <div><dt>Out-of-band check declared by operator</dt><dd>{shown.independent_pin_confirmed_by_operator?"YES (SELF-DECLARED)":"NO"}</dd></div>
        <div><dt>Issuer identity authenticated by this app</dt><dd>NO</dd></div>
        <div><dt>GitHub checks independently rerun</dt><dd>NO</dd></div>
        <div><dt>Merge/deployment authorization</dt><dd>NONE</dd></div>
      </dl>
      {shown.key_id&&<p>Key fingerprint: <code>{shown.key_id}</code></p>}
      {shown.report_sha256&&<p>Exact report SHA-256: <code>{shown.report_sha256}</code></p>}
      <p className="vpsig-warning">{shown.warning}</p>
    </div>}
    <p className="vpsig-boundary">
      No signing key or trusted issuer identity is bundled. No browser storage,
      network fetch, source re-query, write permission, job execution, model call,
      or auto-merge is performed by this signature desk. A sender can fabricate a
      valid signature using their own key, so mathematical validity is not issuer
      authentication. Inspect source and GitHub policy separately.
    </p>
  </section>;
}
