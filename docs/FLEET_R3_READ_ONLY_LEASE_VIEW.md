# PhiMadaPrime R3: local lease observations

This complements RepoNerve R1 and logical steward roster R2. It never
contacts localhost or retrieves private fleet data over the public website.

Workflow: run Agentora R3 steward-claim status and redirect the JSON output to
a local file. Review it, then use the RepoNerve tab's third file import to
inspect the redacted reservation observations in the current browser session.

A reservation is not an active AI worker. It means a local lease was granted
to a proposed worker name for a given repository and generation. The lease
can expire without the worker stopping. The frontend labels expiry since
export separately from a reservation that is still current.

Validation rejects extra fields (including tokens and private data), foreign
repository IDs, archived repositories, stale source scans, duplicate IDs,
forged authorization and fake executed-job counts. Imported scan IDs must
match other loaded RepoNerve/Agentora files when those files are present.

The view is intentionally file-import-only. Automated dispatch, actual worker
runs, GitHub mutation, PR merge, and production deployment remain external,
independently authorized responsibilities of future rungs.
