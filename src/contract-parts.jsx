import React, { useState } from "react";
import {
  CHECK_LABELS, CONTRACT_TYPES, contractProgress
} from "./contracts.mjs";

export function ContractDesk({ repo, contract, suggestedTypes, sourceSha,
  onCreate, onToggle, onSetNote, onRebase, onDelete }) {
  const initial = suggestedTypes?.filter(t => Object.hasOwn(CONTRACT_TYPES, t)) || [];
  const [types, setTypes] = useState(initial.length ? [...new Set(initial)] : ["manual_review"]);
  const isPublic = !repo.exampleOnly;
  const progress = contract ? contractProgress(contract, sourceSha) : null;
  const typeItems = Object.entries(CONTRACT_TYPES);
  const toggleType = type => {
    setTypes(previous => previous.includes(type) ?
      previous.filter(x => x !== type) :
      [...previous.filter(x => x !== "manual_review"), type]);
  };
  return <section className="contract-desk" aria-label="Local completion contract">
    <h3>PROJECT COMPLETION CONTRACT</h3>
    <p>Define what "finished" must mean for this project. This is a local operator checklist,
      not independent test evidence or merge approval.</p>
    {!isPublic ? <p>Contracts require a verified public repository from the live catalog.</p> :
      !contract ? <>
        <div className="contract-intro">
          <strong>No completion contract prepared</strong>
          <span>Choose the project's actual deliverable type. The office won't assume every repo needs a React page.</span>
          {initial.length > 0 && <small>Types preselected from Agentora's candidate classification. Human confirmation required.</small>}
        </div>
        <fieldset className="contract-type-choices">
          <legend>Required project surfaces</legend>
          {typeItems.map(([key, value]) =>
            <label key={key}><input type="checkbox" checked={types.includes(key)}
              onChange={() => toggleType(key)} /> {value.label}</label>)}
        </fieldset>
        <button type="button" className="contract-action" disabled={types.length < 1}
          onClick={() => onCreate(types)}>
          Prepare local contract ({types.length} {types.length === 1 ? "surface" : "surfaces"})
        </button>
      </> : <>
        <div className="contract-header">
          <strong>{progress.locallyReviewed}/{progress.checks} locally reviewed</strong>
          <span>{progress.sourceState.replaceAll("_", " ")}</span>
        </div>
        <p className="contract-warning">
          {progress.sourceState === "SOURCE_CHANGED" ?
            "Observed source changed since this contract was prepared. Old review marks cannot certify the new revision." :
            progress.sourceState === "HEAD_NOT_CONFIRMED" ?
              "Current source HEAD is not confirmed. Record scope notes, then verify a commit before treating any review as current." :
              "Contract refers to the currently observed SHA. This is still not independently verified software."}
        </p>
        <small>Source commit: {contract.source_sha?.slice(0, 12) || "UNVERIFIED"}</small>
        <div className="contract-types">
          {contract.surface_types.map(x => <span key={x}>{CONTRACT_TYPES[x]?.label || x}</span>)}
        </div>
        <div className="contract-checks">
          {contract.checks.map(item => <div className="contract-check" key={item.id}>
            <label><input type="checkbox" checked={item.locally_reviewed}
              onChange={e => onToggle(item.id, e.target.checked)} />
              <span>{CHECK_LABELS[item.id]}</span></label>
            <textarea value={item.note} rows={2} maxLength={500}
              aria-label={"Notes for " + CHECK_LABELS[item.id]}
              onChange={e => onSetNote(item.id, e.target.value)}
              placeholder="Local notes or evidence references. Not a certified result." />
          </div>)}
        </div>
        <div className="contract-action-row">
          {sourceSha && sourceSha !== contract.source_sha &&
            <button type="button" className="contract-action"
              onClick={() => onRebase(sourceSha)}>Rebind to observed HEAD
              (clears review ticks)</button>}
          <button type="button" className="contract-danger"
            onClick={onDelete}>Discard local contract</button>
        </div>
      </>}
    <small className="contract-safety">Only operator annotations. Verified complete: 0.
      Nothing is sent to GitHub, Agentora or another service. Export contracts before refreshing.</small>
  </section>;
}

export function ContractDirectory({ contracts, rows, onVisit }) {
  const all = Object.values(contracts);
  const map = new Map(rows.map(x => [x.id, x]));
  return <div className="contract-directory">
    <h3>Completion Contracts</h3>
    <p>{all.length} local project {all.length === 1 ? "contract" : "contracts"} prepared.
      These are not completed projects.</p>
    {!all.length ? <small>Open a public repo desk and prepare an acceptance checklist.
      You can export your work as local JSON.</small> :
      <div className="contract-directory-list">
        {all.sort((a, b) => a.repository.localeCompare(b.repository)).map(c => {
          const repo = map.get(c.repository_id);
          if (!repo) return null;
          const count = c.checks.filter(x => x.locally_reviewed).length;
          return <button type="button" key={c.repository_id}
            onClick={() => onVisit(repo.name)}>
            <strong>{repo.name}</strong>
            <small>{count}/{c.checks.length} locally reviewed, not verified</small>
          </button>;
        })}
      </div>}
    <p className="contract-safety">These contracts are stored only in this browser session.
      No background syncing, task execution, merge permissions or "done" claims.</p>
  </div>;
}
