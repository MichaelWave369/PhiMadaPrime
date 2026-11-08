# Φ World R2: Local Model Arena

R2 adds an opt-in Node.js command-line harness that asks a LOCAL Ollama model for proposals in a fictional ten-agent town. A separate server-side simulation policy checks the model output. No real PhiBots, external tools, bank accounts, devices or GitHub writes are exposed.

## Run an offline fixture

    node scripts/phi_world_local_model.mjs --mock --scenario collision --days 1 --out phi-world-mock.json

## Run a real local model

First start Ollama and verify you have an appropriate model with ollama list.

    node scripts/phi_world_local_model.mjs --model qwen3:4b --scenario injection --days 1 --out phi-world-ollama.json

Ten fictional agents make one sequential local request per simulated day. R2 caps runs at three days and fixes the Ollama HTTP target to http://127.0.0.1:11434/api/generate. No remote provider, alternate URL, listening server or agent tool execution endpoint exists.

Open PhiMadaPrime, select Φ World, then Import R2 receipt. Imports are inspected in-browser, never uploaded. The site does not call Ollama. An imported record is independent of the deterministic R1 browser scenario.

## Safety invariants

- Model text is untrusted data, never executable code. The local adapter only accepts a strict JSON object with action and targetId fields.
- Agent identities are assigned by the harness, not claimed by the model.
- Only work, rest and share can modify fictional credits and energy. Steal, sabotage, escalate, exfiltrate and erase_audit are always rejected by the Node policy.
- Invalid output, timeout or unavailable Ollama is recorded as a denial without fallback execution.
- Hard bounds: three days, ten agents, 30-second local HTTP timeout, 64-KB transport response cap, 1-KB model proposal cap, 300-KB import receipt cap.
- No credentials, private files, real tools or device endpoints are passed to the model.
- Evidence output uses exclusive file creation, preventing silent overwrites.

## Evidence limitations

The receipt includes source label, scenario, model name, event decisions, toy resources, and an SHA-256 chain from metadata through events and summary. The importer checks sequence, schema, counters and hash chain.

**The chain is not a digital signature.** Anyone with write access to the file can rewrite all events and recompute hashes. R2 has no authenticated runtime identity, trusted timestamps, signed logs or persistent append-only audit store. It is a reproducible inspection artifact, not proof that a specific model behaved as claimed.

Run checks with:

    node --test tests/world-local-model.test.mjs
    npm test
    npm run build

## Future R3

A separately reviewed operator-owned runtime bridge could enroll observation-only PhiBot adapters, maintain authenticated short-lived capabilities, enforce per-tool budgets and approvals, and persist signed receipts. Public GitHub Pages must stay unprivileged and import-only. The ThinkTank must never confer authority merely through a UI button or an agent's instructions.