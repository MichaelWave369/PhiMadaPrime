import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileTree, useFileTree, useFileTreeSelection } from "@pierre/trees/react";
import { PatchDiff } from "@pierre/diffs/react";
import { buildForgePatch, forgeHandoff, readForgeFiles, readForgePulls } from "./agent-forge.mjs";

const DIFF_OPTIONS = Object.freeze({
  theme: "pierre-dark",
  themeType: "dark",
  diffStyle: "unified",
  preferredHighlighter: "shiki-js"
});

function ChangedFileTree({ files, onSelect }) {
  // A PR's bounded changed-file set is intentionally much smaller than a whole-repo tree.
  const paths = useMemo(() => files.map(file => file.path).sort(), [files]);
  const { model } = useFileTree({
    paths, search: true, initialExpansion: "open",
    flattenEmptyDirectories: true,
    fileTreeSearchMode: "hide-non-matches"
  });
  const selectedPaths = useFileTreeSelection(model);
  useEffect(() => {
    const path = selectedPaths.find(value => paths.includes(value));
    if (path) onSelect(path);
  }, [selectedPaths, paths, onSelect]);
  return <div className="forge-tree" aria-label="Pierre changed-file tree">
    <FileTree model={model} style={{ height: "290px", width: "100%" }} />
  </div>;
}

export function AgentForge({ catalog = [] }) {
  const [search, setSearch] = useState("");
  const [repoId, setRepoId] = useState("");
  const [pulls, setPulls] = useState(null);
  const [review, setReview] = useState(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [reviewedPaths, setReviewedPaths] = useState({});
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const eligible = useMemo(() => catalog.filter(repo => !repo.exampleOnly &&
    Number.isSafeInteger(repo.id) && repo.id > 0 &&
    repo.full_name === "MichaelWave369/" + repo.name), [catalog]);
  const selectedRepo = eligible.find(repo => String(repo.id) === repoId) || null;
  const matches = eligible.filter(repo => (repo.name + " " + (repo.description || ""))
    .toLowerCase().includes(search.trim().toLowerCase()));
  const options = matches.slice(0, 35);
  if (selectedRepo && !options.some(repo => repo.id === selectedRepo.id)) {
    options.unshift(selectedRepo);
  }
  const file = review?.files.find(candidate => candidate.path === selectedPath);
  const patch = useMemo(() => buildForgePatch(file), [file]);
  const reviewedCount = review ? review.files.filter(item => reviewedPaths[item.path]).length : 0;

  function chooseRepo(id) {
    generation.current++;
    setRepoId(id);
    setPulls(null);
    setReview(null);
    setSelectedPath("");
    setReviewedPaths({});
    setLoading("");
    setError("");
    setNotice("");
  }
  async function inspectPulls() {
    if (!selectedRepo || loading) return;
    const current = ++generation.current;
    setLoading("pulls"); setError(""); setNotice("");
    setReview(null); setSelectedPath(""); setReviewedPaths({});
    try {
      const response = await readForgePulls(selectedRepo);
      if (current === generation.current) setPulls(response);
    } catch (err) {
      if (current === generation.current) {
        setPulls(null);
        setError("Public pull requests unavailable. No review evidence inferred.");
      }
    } finally {
      if (current === generation.current) setLoading("");
    }
  }
  async function inspectPr(pr) {
    if (!selectedRepo || loading) return;
    const current = ++generation.current;
    setLoading("files"); setError(""); setNotice("");
    setReview(null); setSelectedPath(""); setReviewedPaths({});
    try {
      const response = await readForgeFiles(selectedRepo, pr.number);
      if (current === generation.current) {
        setReview(response);
        setSelectedPath(response.files[0]?.path || "");
      }
    } catch (err) {
      if (current === generation.current) {
        setError("PR metadata or changed files could not be verified. Nothing approved.");
      }
    } finally {
      if (current === generation.current) setLoading("");
    }
  }
  async function copyHandoff() {
    try {
      if (!navigator.clipboard?.writeText) throw Error("NO_CLIPBOARD");
      await navigator.clipboard.writeText(forgeHandoff(review, selectedPath));
      setNotice("Review-only handoff copied locally; nothing sent to GitHub.");
    } catch {
      setNotice("Clipboard unavailable; nothing copied or submitted.");
    }
  }
  return <section className="agent-forge" aria-label="Agent Forge public code review">
    <header className="forge-header">
      <div>
        <small>ΦMADA PRIME / R28 / PIERRE POWERED</small>
        <h3>AGENT FORGE · CODE REVIEW BAY</h3>
        <p>Inspect real public pull requests, browse changed paths with Pierre Trees,
          and inspect GitHub patches with Pierre Diffs.</p>
      </div>
      <strong>READ ONLY · NO TOKENS · NO MERGE AUTHORITY</strong>
    </header>
    <div className="forge-picker">
      <label>Find a public fleet repository
        <input type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Filter public repositories…" />
      </label>
      <label>Select project
        <select aria-label="Forge repository" value={repoId}
          onChange={event => chooseRepo(event.target.value)}>
          <option value="">Choose a public repository…</option>
          {options.map(repo => <option value={String(repo.id)} key={repo.id}>{repo.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={inspectPulls}
        disabled={!selectedRepo || Boolean(loading)}>
        {loading === "pulls" ? "Reading GitHub…" : "Load open PRs"}
      </button>
    </div>
    <p className="forge-source">{eligible.length} public repos eligible. Showing {
      matches.length > 35 ? "first 35 matches; refine search" : matches.length + " matches"
    }. All GitHub reads happen only when requested, and may be rate-limited.</p>
    {error && <p className="forge-error" role="alert">{error}</p>}
    {pulls && <div className="forge-pr-list" aria-label="Open pull requests">
      <strong>Observed {pulls.pulls.length} open PRs
        {pulls.partial ? " (first 10 only, not a full inventory)" : ""}</strong>
      {pulls.pulls.length ? pulls.pulls.map(pr => <div key={pr.number} className="forge-pr">
        <div><b>#{pr.number} · {pr.title}</b><small>{pr.draft ? "Draft" : "Open"} · head {pr.headSha.slice(0, 12)}</small></div>
        <button type="button" onClick={() => inspectPr(pr)} disabled={Boolean(loading)}>
          Review changes
        </button>
        <a href={pr.url} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
      </div>) : <p>No open PRs among the public results; no changes to review.</p>}
    </div>}
    {review && <div className="forge-review" aria-label="Selected pull request changed files">
      <div className="forge-review-top">
        <div>
          <h4>PR #{review.pr.number} · {review.files.length} displayed changed files</h4>
          <p>Head <code>{review.pr.headSha}</code></p>
          <p>Base <code>{review.pr.baseSha}</code></p>
          {review.partial && <p className="forge-warning">Only the first 50 files were read. This is not a complete PR review.</p>}
          {review.skipped > 0 && <p className="forge-warning">{review.skipped} unsafe or unsupported paths excluded.</p>}
        </div>
        <span>{reviewedCount}/{review.files.length} locally marked · 0 GitHub approvals</span>
      </div>
      {review.files.length ? <div className="forge-review-grid">
        <div className="forge-file-sidebar">
          <strong>Changed paths · Pierre Trees</strong>
          <ChangedFileTree key={review.pr.number + ":" + review.pr.headSha} files={review.files} onSelect={setSelectedPath} />
          <label>Choose changed file
            <select value={selectedPath} onChange={event => setSelectedPath(event.target.value)}>
              {review.files.map(item => <option key={item.path} value={item.path}>{item.path}</option>)}
            </select>
          </label>
        </div>
        <div className="forge-patch-panel">
          {file && <>
            <div className="forge-file-head">
              <div><strong>{file.path}</strong><small>{file.status} · +{file.additions ?? "?"} / -{file.deletions ?? "?"}</small></div>
              <button type="button" onClick={() => setReviewedPaths(previous =>
                ({ ...previous, [file.path]: !previous[file.path] }))}>
                {reviewedPaths[file.path] ? "✓ Locally reviewed" : "Mark locally reviewed"}
              </button>
            </div>
            {patch ? <div className="forge-diff" aria-label={"Read-only patch for " + file.path}>
              <PatchDiff key={review.pr.headSha + ":" + file.path} patch={patch} options={DIFF_OPTIONS} />
            </div> : <p className="forge-warning">GitHub omitted or exceeded the safe patch size for this file.
              Binary/large diff content is not available in this view. Inspect the PR on GitHub.</p>}
            <button type="button" className="forge-copy" onClick={copyHandoff}>Copy review-only handoff</button>
          </>}
        </div>
      </div> : <p>No supported changed-file paths. Open the PR directly on GitHub.</p>}
      {notice && <p role="status">{notice}</p>}
      <p className="forge-disclaimer">Read-only public metadata is not proof of completeness.
        Local review marks are session-only and cannot approve PRs, merge code,
        dispatch agents, or certify test results. Verify current SHA and independent checks before release.</p>
    </div>}
    {!pulls && !loading && !error && <p className="forge-empty">
      Select a real public repository and load its open PRs. No automatic background crawling.
    </p>}
  </section>;
}
