# Autonomous Turn R1 in the One-Repo Completion Lane

This milestone adds an Agentora-specific panel within the existing lane. It
preserves the full fleet picker, completion contracts, exact-HEAD signals, R8
verification requests and R0.3 local intake-return panel.

Choose Agentora, refresh HEAD and prepare a documentation task. The panel checks
numeric repository identity and main twice, reads the exact source file and
creates a useful bounded literal edit with a four-hour expiry, allowed path,
diff budget, fixed tests and a digest. Submitting its prefilled GitHub issue is
**untrusted intake**. Only a separate genuine GitHub protected-environment review
with `APPROVE <task digest>` can authorize that run. The page never receives or
sends GitHub credentials and makes no API writes.

The documentation task clarifies stale-review invalidation. The code task uses
React Router NavLink's active-page accessibility behavior; it retains Agentora's
independent-review code policy. It cannot silently take the owner-authored solo
merge lane when the publisher is a GitHub App.

After the required [Agentora installation](https://github.com/MichaelWave369/Agentora/blob/main/docs/AUTONOMOUS_TURN_R1.md),
the hosted worker/publisher/CI/gate stages run there. The panel discovers recent
task PRs or reads one exact PR number. It accepts no uploaded receipt as proof.
It reads the GitHub-Actions result check, recomputes the task digest, corroborates
the original numeric owner review and run/controller/job, rechecks genuine CI on
the current PR SHA and independently reads the merge record/commit. Missing,
ambiguous, stale, forged or rate-limited data holds. A later PR change invalidates
the read; refresh after the controller job finishes.

The interface distinguishes MERGED, AUTOMATED CHECKS PASSED, and PROJECT VERIFIED
COMPLETE. The last is always false here. Outstanding project acceptance is
displayed separately. Metadata correlation does not reproduce the controller's
full tree/policy/security verification or certify a running product.

The new panel is an implementation candidate until Agentora's reviewed
infrastructure, scoped App credential and owner environment are installed and a
real turn succeeds. Local JS fixtures are synthetic API records, not field
evidence. No PaperGhost execution or merge is implied.
