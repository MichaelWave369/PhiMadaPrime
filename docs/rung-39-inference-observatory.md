# R39: Φ Inference Observatory inside PhiMadaPrime

**Φ Inference Fabric milestone 16.** This room adds a local-only, review-only
view for the existing PhiStream/PhiServe evidence workflow, under
**ThinkTank → Inference Observatory**.

## Data flow (no execution)

1. PhiStream's operator-initiated hardware snapshot observes host RAM
   and, with opt-in CUDA, CUDA memory at one instant.
2. PhiServe's R13 benchmark creates separate local measured JSON receipts
   for a registered licensed GGUF using the real llama-server executable.
3. PhiServe R15's offline phiserve-advisor compares the hardware snapshot
   to compatible GGUF receipts and creates a read-only advisory.
4. In PhiMadaPrime's ThinkTank, select one R15 JSON output, optionally
   together with the original snapshot and benchmark JSON files.
5. The browser checks the declared R15 shape, recomputes the simple
   file-size capacity floors, checks the review/hold classification,
   calculates how old the evidence is at **view time**, and, when sources
   are provided, matches original file SHA-256 digests and key values.

A source-hash match does **not** authenticate the producer, prove the snapshot
came from the same physical computer, prove that the model fits in RAM/VRAM,
or certify any performance improvement. R15 classifications are review
labels, not machine execution permission. The site never contacts a local
model or captures system counters on its own.

## Import guide

From the ThinkTank top nav, open **Inference Observatory**. Select local
JSON files together in a single file-picker operation:

- Exactly one R15 capacity-advice JSON, e.g. capacity-advice.json
- Optionally its original PhiStream hardware snapshot JSON
- Optionally all 1–8 matching original PhiServe R13 benchmark JSON files

Each must be 1 MiB or smaller, with a total of 10 files or fewer.
You do **not** need to import model weights, Python configurations,
credential files, the GGUF itself, or the private models registry.
The selected JSON is parsed in browser memory; none is uploaded.
The room does not cache imports or place their contents in localStorage.

With only the R15 report, it displays its reported metrics but shows
**UNVERIFIED_SOURCE_FILES**. With some original source files matching,
it shows **PARTIAL_LOCAL_BYTES_MATCH**. Only when all original source hashes
match and their key values agree can it show
**LOCAL_BYTES_MATCH_NOT_AUTHENTICATED**. This is a limited local consistency
check, not independently signed provenance.

The import also computes **RECENT_AT_VIEW** or
**STALE_OR_FUTURE_AT_VIEW** based on the current viewing time, a conservative
5-minute snapshot age and 7-day benchmark age. The original R15 producer
classification remains separately labeled so a report created days ago
cannot be mistaken for today's RAM/VRAM availability.

## Displayed observations

- Model alias and GGUF byte size, without local model file paths.
- Observed available RAM and CUDA-free bytes, if collected by PhiStream.
- Remaining selected reserve budgets and basic **full file-size floors**.
  These are never actual GGUF working-set or hybrid offload fit estimates.
- Per-config requested GPU layers, p50 and p95 entire HTTP request
  duration, model startup duration, and optional median reported
  end-to-end token throughput.
- Matched/expected source file counts, freshness, and the
  origin-claimed review classification.

No automatic routes, permissions, model switching, benchmarks, API keys,
web fetches or cloud telemetry are provided. The optional
**Copy safe, review-only summary** button copies small categorical metadata
after explicit user interaction; it does not copy prompts, local paths or
raw imported documents.

## Checks

~~~bash
npm test
npm run build
~~~

A separate suite, tests/inference-observatory.test.mjs, uses entirely
synthetic R15, R13 and PhiStream JSON. It checks capacity arithmetic,
missing/stale hardware observations, source digest mismatch, fake authority,
tampered throughput and local provenance labeling.

**GitHub CI passing does not imply RTX 5070 or RTX 3060 physical benchmark
coverage.** To qualify a real model profile, gather those observations
locally first, then import the files. PhiServe R14 queue and its default
disabled state remain unchanged; a later, separately governed milestone
would be required for live routing.
