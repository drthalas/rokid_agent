# ALE-470 — STT quality and HUD readability

SESSION: NEW SESSION. MODEL/EFFORT: requested GPT-6 Astra / Medium; actual runtime identity unavailable.
WHY: separate bounded STT/HUD usability issue. Process: STANDARD.

[Linear ALE-470](https://linear.app/drthalas/issue/ALE-470) owns status.
Baseline: `7514d1617adebe9cb2c7a5bdf0f297bc59a369d5`, clean managed worktree,
verified against fetched origin/main. ALE-469 remains in its own worktree.

## Scope and acceptance

Compare current base CPU against full large-v3-turbo Metal, with/without a concise
technical vocabulary prompt, on identical controlled Russian WAVs. Prefer measured
quality with interactive latency. Quantized turbo only if full turbo is too slow/unstable.
Confirm actual Metal backend, preserve local audio handling, bounds, serialization,
cleanup, safe failures and `/v1/stt` contract. Support bounded validated prompt config.
Synthetic Milena speech is a repeatable proxy, not RV101 microphone acceptance.

Diagnose output/history/rendering independently. Preserve meaningful assistant lines,
blank sections, identifiers, names and URLs through HUD/history/reopen. Ordinary prose
must remain unchanged. Keep speech preview natural without another model call.

No production config mutation/restart, AIX deployment, screenshot/error recovery or
approval changes. No dependencies, protocol changes or general UI redesign.

## Plan and verification

1. Inspect installed CLI, production STT fields only, hardware and saved text structure.
2. Generate controlled WAVs locally; benchmark sequentially with numeric timing/memory,
   exact synthetic transcripts, hashes and normalized CER/WER. Retain no user recordings.
3. Implement minimal STT config/prompt and supported HUD presentation fixes with regression tests.
4. Run targeted unit/config, real isolated HTTPS STT smoke, cleanup/busy/error checks;
   AIUI rendering/history/reopen/TTS and affected integration checks. No full release matrix.
5. Review diff, docs, secrets/index/reachable history; commit/push checkpoint, update issue.
   Stop before production. Next phase requires guarded integration and physical RV101 tests.

Diagnostic bounds: CLI/runtime probes 30s, each inference 90s, download 15min;
stop when supported flags/backend/layout behavior are established. Change method after
equivalent failures; at most three materially different approaches per blocker.
