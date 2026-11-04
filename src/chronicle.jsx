import React, { useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PatchDiff } from "@pierre/diffs/react";
import { buildForgePatch } from "./agent-forge.mjs";
import {
  CHRONICLE_STAGES, chronicleFlow, chronicleHandoff,
  readChronicleBranches, readChronicleHistory, readChronicleChange
} from "./chronicle.mjs";

const DIFF_OPTIONS = Object.freeze({
  theme: "pierre-dark", themeType: "dark",
  diffStyle: "split", preferredHighlighter: "shiki-js"
});

export function Chronicle({ catalog = [] }) {
  const [query, setQuery] = useState("");
  const [repoId, setRepoId] = useState("");
  const [branches, setBranches] = useState(null);
  const [branchName, setBranchName] = useState("");
  const [history, setHistory] = useState(null);
  const [selectedSha, setSelectedSha] = useState("");
  const [change, setChange] = useState(null);
  const [path, setPath] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeNode, setActiveNode] = useState("catalog");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);

  const repos = useMemo(() => catalog.filter(repo => repo && !repo.exampleOnly &&
    Number.isSafeInteger(repo.id) && repo.id > 0 &&
    repo.full_name === "MichaelWave369/" + repo.name)
    .sort((a,b) => a.name.localeCompare(b.name)), [catalog]);
  const selectedRepo = repos.find(repo => String(repo.id) === repoId) || null;
  const matching = repos.filter(repo =>
    (repo.name + " " + (repo.description || "")).toLowerCase()
      .includes(query.trim().toLowerCase()));
  const options = matching.slice(0,30);
  if (selectedRepo && !options.some(repo => repo.id === selectedRepo.id))
    options.unshift(selectedRepo);
  const selectedCommit = history?.commits.find(item => item.sha === selectedSha) || null;
  const selectedFile = change?.files.find(item => item.path === path) || null;
  const patch = useMemo(() => buildForgePatch(selectedFile), [selectedFile]);
  const graph = useMemo(() => chronicleFlow(
    selectedRepo,branches,history,change,copied
  ), [selectedRepo,branches,history,change,copied]);
  const nodeDetail = graph.stages.find(item => item.id === activeNode) || graph.stages[0];

  function changeRepo(value) {
    generation.current++;
    setRepoId(value); setBranches(null); setBranchName("");
    setHistory(null); setSelectedSha(""); setChange(null); setPath("");
    setBusy(""); setError(""); setNotice(""); setCopied(false);
    setActiveNode("catalog");
  }
  function changeBranch(value) {
    generation.current++;
    setBranchName(value); setHistory(null); setSelectedSha("");
    setChange(null); setPath(""); setBusy(""); setError("");
    setNotice(""); setCopied(false);
  }
  function changeCommit(sha) {
    generation.current++;
    setSelectedSha(sha); setChange(null); setPath("");
    setBusy(""); setError(""); setNotice(""); setCopied(false);
  }
  async function loadBranches() {
    if (!selectedRepo || busy) return;
    const turn = ++generation.current;
    setBusy("branches"); setError(""); setNotice("");
    setBranches(null); setBranchName(""); setHistory(null);
    setSelectedSha(""); setChange(null); setPath(""); setCopied(false);
    try {
      const result = await readChronicleBranches(selectedRepo);
      if (turn === generation.current) {
        setBranches(result); setBranchName(result.defaultBranch);
        setActiveNode("branches");
      }
    } catch {
      if (turn === generation.current) {
        setError("Public branch inventory failed verification. No branch history inferred.");
      }
    } finally {
      if (turn === generation.current) setBusy("");
    }
  }
  async function loadHistory() {
    if (!selectedRepo || !branches?.branches.some(item => item.name === branchName) || busy) return;
    const turn = ++generation.current;
    setBusy("history"); setError(""); setNotice("");
    setHistory(null); setSelectedSha(""); setChange(null); setPath(""); setCopied(false);
    try {
      const result = await readChronicleHistory(selectedRepo, branchName);
      if (turn === generation.current) {
        setHistory(result);
        setSelectedSha(result.commits[0]?.sha || "");
        setActiveNode("history");
      }
    } catch {
      if (turn === generation.current) {
        setError("Branch HEAD or immutable commit window could not be verified.");
      }
    } finally {
      if (turn === generation.current) setBusy("");
    }
  }
  async function loadChange() {
    if (!selectedRepo || !selectedCommit?.parentSha || busy) return;
    const turn = ++generation.current;
    setBusy("diff"); setError(""); setNotice("");
    setChange(null); setPath(""); setCopied(false);
    try {
      const result = await readChronicleChange(
        selectedRepo, selectedCommit.sha, selectedCommit.parentSha
      );
      if (turn === generation.current) {
        setChange(result); setPath(result.files[0]?.path || "");
        setActiveNode("diff");
      }
    } catch {
      if (turn === generation.current) {
        setError("Commit or first-parent identity mismatch. No patch inferred.");
      }
    } finally {
      if (turn === generation.current) setBusy("");
    }
  }
  async function copyHandoff() {
    try {
      if (!navigator.clipboard?.writeText) throw Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(chronicleHandoff(history,change,path));
      setCopied(true); setActiveNode("handoff");
      setNotice("Review handoff copied locally. Nothing submitted, executed or restored.");
    } catch {
      setCopied(false); setNotice("Clipboard unavailable; no handoff was copied.");
    }
  }

  return <section className="chronicle" aria-label="Agent Flow and Chronicle">
    <header className="chronicle-header">
      <div>
        <small>ΦMADA PRIME / R29 / AGENT FLOW + CHRONICLE</small>
        <h3>THE DEVELOPMENT TIME MACHINE</h3>
        <p>On-demand, real public GitHub history, with a navigable
          review workflow. This is an observation graph, not an active worker scheduler.</p>
      </div>
      <strong>READ ONLY · NO RESTORE · NO AUTOMATED EXECUTION</strong>
    </header>
    <div className="chronicle-picker">
      <label>Search public fleet
        <input type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Find a repository…" />
      </label>
      <label>Repository
        <select value={repoId} onChange={event => changeRepo(event.target.value)}
          aria-label="Chronicle public repository">
          <option value="">Choose a public project…</option>
          {options.map(repo => <option key={repo.id} value={String(repo.id)}>{repo.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={loadBranches} disabled={!selectedRepo || !!busy}>
        {busy === "branches" ? "Reading branches…" : "Load branches"}
      </button>
    </div>
    <p className="chronicle-source">{repos.length} public repositories eligible. {
      matching.length > 30 ? "Showing 30 matches; refine search." :
      "Showing " + matching.length + " matches."
    } Each read is explicitly requested. No GitHub credential forwarding.</p>
    {error && <p role="alert" className="chronicle-warning">{error}</p>}

    <div className="chronicle-flow-header">
      <div><h4>AGENT FLOW · OBSERVATION GRAPH</h4>
        <p>What has actually been inspected, and what still belongs to human review.</p></div>
      <span>Never equate a visible node with an executed task.</span>
    </div>
    <div className="chronicle-graph" aria-label="Interactive read-only observation flow">
      <ReactFlow nodes={graph.nodes} edges={graph.edges}
        onNodeClick={(_event,node) => setActiveNode(node.id)}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable
        panOnDrag zoomOnScroll={false} fitView fitViewOptions={{padding:0.16}}
        minZoom={0.35} maxZoom={1.5} proOptions={{hideAttribution:false}}
        colorMode="dark">
        <Background color="#51657e" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
    <div className="chronicle-node-caption" role="status">
      <strong>{nodeDetail.title} · {nodeDetail.status}</strong>
      <span>{nodeDetail.detail}</span>
    </div>

    {branches && <div className="chronicle-branch-panel">
      <div className="chronicle-panel-title">
        <h4>BRANCH DIRECTORY</h4>
        <span>{branches.observedAt} · {branches.branches.length} observed
          {branches.partial ? " · first 20 only" : ""}</span>
      </div>
      {branches.partial && <p className="chronicle-warning">
        Exactly 20 branches returned; this may be only the first API page.
        No complete branch inventory claim is made.</p>}
      <div className="chronicle-branch-select">
        <label>Choose observed branch
          <select value={branchName} onChange={e => changeBranch(e.target.value)}
            aria-label="Chronicle branch">
            {branches.branches.map(branch =>
              <option value={branch.name} key={branch.name}>{branch.name}{
                branch.name === branches.defaultBranch ? " (default)" : ""}</option>)}
          </select>
        </label>
        <button type="button" onClick={loadHistory} disabled={!!busy}>
          {busy === "history" ? "Reading commits…" : "Load commit history"}
        </button>
      </div>
      <p className="chronicle-source">
        Commit history is pinned to the branch's observed head SHA.
        A subsequent branch push will not silently modify this snapshot.
      </p>
    </div>}

    {history && <div className="chronicle-history">
      <div className="chronicle-panel-title">
        <h4>CHRONICLE · {history.branch}</h4>
        <span>Head {history.headSha.slice(0,12)} · {history.observedAt}</span>
      </div>
      {history.partial && <p className="chronicle-warning">
        First 25 commits only; this is a bounded timeline, not the full history.</p>}
      <ol className="chronicle-timeline" aria-label="Recent commits on selected immutable branch head">
        {history.commits.map((commit,index) => <li key={commit.sha}>
          <button type="button" className={selectedSha === commit.sha ? "chosen" : ""}
            aria-pressed={selectedSha === commit.sha}
            onClick={() => changeCommit(commit.sha)}>
            <span className="chronicle-commit-dot" aria-hidden="true"/>
            <span className="chronicle-commit-copy">
              <strong>{commit.title}</strong>
              <small>{commit.sha.slice(0,12)} · {commit.author} · {
                commit.date ? commit.date.slice(0,16).replace("T"," ")+" UTC" : "date unavailable"
              }</small>
            </span>
            {index === 0 && <em>OBSERVED HEAD</em>}
          </button>
        </li>)}
      </ol>
      {selectedCommit && <div className="chronicle-selected">
        <div><strong>SELECTED COMMIT · {selectedCommit.sha}</strong>
          <p>{selectedCommit.title}</p>
          <span>{selectedCommit.parentSha ?
            "First parent: " + selectedCommit.parentSha :
            "Root commit: no first-parent diff available"}</span></div>
        <div className="chronicle-selected-actions">
          <a href={selectedCommit.url} target="_blank" rel="noopener noreferrer">
            Open commit on GitHub ↗</a>
          <button type="button" disabled={!selectedCommit.parentSha || !!busy}
            onClick={loadChange}>
            {busy === "diff" ? "Reading diff…" : "Inspect first-parent diff"}
          </button>
        </div>
      </div>}
    </div>}

    {change && <div className="chronicle-change" aria-label="Read-only Git commit patch inspector">
      <div className="chronicle-panel-title">
        <h4>PIERRE DIFFS · COMMIT COMPARISON</h4>
        <a href={change.compareUrl} target="_blank" rel="noopener noreferrer">
          Open GitHub comparison ↗</a>
      </div>
      <p className="chronicle-source">Comparing {change.parentSha.slice(0,12)} → {
        change.sha.slice(0,12)} · observed {change.observedAt}</p>
      {change.partial && <p className="chronicle-warning">
        Exactly 40 changed files returned; more may exist. This is not an exhaustive diff.</p>}
      {change.skipped > 0 && <p className="chronicle-warning">
        {change.skipped} unsupported or unsafe file paths excluded.</p>}
      {change.files.length ? <>
        <label className="chronicle-file-select">Changed file
          <select value={path} onChange={event => {
            setPath(event.target.value);setCopied(false);setNotice("");
          }} aria-label="Chronicle changed file">
            {change.files.map(file => <option key={file.path} value={file.path}>
              {file.path} ({file.status})
            </option>)}
          </select>
        </label>
        {selectedFile && <div className="chronicle-file-head">
          <strong>{selectedFile.path}</strong><small>+{selectedFile.additions ?? "?"}
            / -{selectedFile.deletions ?? "?"}</small>
        </div>}
        {patch ? <div className="chronicle-diff">
          <PatchDiff key={change.sha+":"+path} patch={patch} options={DIFF_OPTIONS} />
        </div> : <p className="chronicle-warning">
          GitHub did not supply a supported textual patch for this file.
          It may be binary or too large; inspect the GitHub comparison instead.</p>}
        <button type="button" className="chronicle-copy" onClick={copyHandoff}>
          Copy immutable-SHA review handoff
        </button>
      </> : <p>No supported changed-file paths returned by GitHub.</p>}
      {notice && <p role="status" className="chronicle-notice">{notice}</p>}
    </div>}
    {!branches && !busy && !error && <p className="chronicle-empty">
      Select a public repository, load its branches, then inspect its commits and code history.
      No saved states or restored files are invented.</p>}
    <p className="chronicle-disclaimer">
      This view has no access to private repositories, Git write APIs, worker credentials,
      automated PR approval or restoration. It observes a bounded public history.
      A green node means information was observed, not that functionality was tested.
      Check present HEAD and independent evidence before any merge or rollback.
    </p>
  </section>;
}
