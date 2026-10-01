# RV101 HUD history and latency diagnosis

Status: implemented and locally verified; private cloud deployment / physical measurement pending at source commit. Baseline: ab5d52f.
Process: bounded change with explicit privacy/diagnostic contracts. Uses installed Spec Kit
specification guidance/template and constitution; the user's single-artifact requirement keeps
specification, plan and validation here instead of generating separate plan/tasks/checklist files.
No Git/MCP/extension hooks installed. No new external capability or permission.

## User Scenarios & Testing

### P1 — Read one answer and continue a visible conversation

Observed physical feedback: tap→record and tap→send work; states are acceptable. Long answers
appear twice. Previous exchanges disappear on the next question. Expected: each assistant final
appears once, preceded by its user transcript; the latest exchange is selected by default, previous
exchanges remain scrollable during recording and later answers. Speech summary is TTS-only.

Acceptance: short answer is complete, long answer scrolls; retain at most six exchanges with bounded
per-field text and total storage; repeated snapshots do not duplicate entries. Reopen restores the
same session's locally captured history without speaking old answers. A new session never inherits
old entries. No backfill from arbitrary Codex/Desktop history is claimed.

### P1 — Demonstrate continuity independently of HUD history

Before changing conversation UI, run three short turns against the existing real gateway. Report
only sessionId/threadId/turnId and pass/fail, never speech/answer content. Same session and thread,
three distinct turn IDs; controlled memory assertion in process. If this fails, investigate rather
than replacing the thread architecture. Mock integration then covers three turns and reconnect.

### P2 — Measure before optimizing

Collect T0 recorder stop; T1 audio request start; T2 full audio body received Mac; T3 STT entry;
T4 STT complete; T5 turn/start send; T6 ACK; T7 first agent delta; T8 completion; T9 completed
snapshot received; T10 HUD update callback; T11 TTS playback requested. T11 is not proof of audible
onset if native API exposes no such callback. Retain identifiers/times/safe reason only in diagnostics.

Report minimum three *physical* short queries, median and min/max: debounce, upload, STT, Codex
TTFT/total, polling/UI lag and perceived total. Client/Mac clocks cannot be naively subtracted:
report same-clock durations and estimate cross-clock intervals with offset/RTT uncertainty; do not
present estimates as exact upload time. Missing events remain unavailable, never zero-filled.
Physical baseline requires deployment/resource update and wearer queries; local synthetic/text
measurements cannot satisfy that gate. This iteration stops ready for that RV101 test.

### P2 — Understand errors

Known errors have concise Russian messages; diagnostics keep an allowlisted bounded machine code.
Unknown/native raw strings (including reported “Glasses 4060 …”) are not displayed or logged.
Gmail reproduction/integration is excluded; do not enable MCP/apps/plugins/network to investigate it.

## Requirements

- FR-1: One HUD rendering of each assistant response; TTS may summarize independently.
- FR-2: Six exchanges maximum, user ≤8000 chars/answer ≤16000 chars; bounded session-local storage.
  User-requested conversation content stays in native agent storage, never diagnostic logs or Git.
  Do not store credentials in history; known configured credential strings must be redacted.
- FR-3: History entries correlate requestId and turnId; ACK loss/replay retains original UUID and
  cannot create duplicate entries. Session/thread mismatch fails visibly, never silently remaps.
- FR-4: Preserve history through listening/transcribing/busy/errors; swipe scrolls history; new result
  targets latest exchange, repeated identical poll does not reset user scroll.
- FR-5: Diagnostics are bounded, schema-validated numbers/IDs/enumerated codes only; no audio,
  prompts, transcripts, answers, headers, tokens, URLs or arbitrary error strings.
- FR-6: Add only optional timing metadata/diagnostic transport required for measurements. Preserve
  all existing v1 routes/auth, project allowlist, approvals, idempotency/recovery and Codex policies.
  Legacy clients remain compatible. No new unauthenticated endpoint.
- FR-7: Do not tune 650 ms debounce, 1000 ms polling, model/effort or replace whisper process until
  measured bottlenecks justify it. Investigate whisper startup/model load via numeric local profiling;
  propose persistent server only if evidence justifies added lifecycle/attack surface.
- FR-8: Commit/push reviewed safe source and deploy private AIX, preserving endpoint/token/Camera.
  Read back active cloud package and verify modified runtime files/config/version without secret output.
  Never Submit for Review. Final hardware acceptance stays explicit.

## Key Entities / Risks

Exchange: session/thread + request/turn identity, bounded user/final content. Diagnostic sample:
random capture ID, session/thread/turn IDs, timestamps, bounded phase/reason; separate from history.
Risks: native storage exhaustion, stale ACK/poll races, runtime list/scroll support, credential text
returned by a model, cross-clock errors, diagnostic upload adding latency, TTS startup ambiguity.
Mitigations: size caps, strict schemas, no broad logging, best-effort telemetry isolated from execution,
regression tests, offline text fallback, clearly labeled measurement uncertainty.

## Plan / affected components

1. Real three-turn continuity baseline using existing authenticated gateway, content-free output.
2. Frontend bounded history/controller + single history HUD + TTS-only summary + normalized errors.
3. Instrument frontend boundaries and Mac STT/Codex execution without changing business decisions;
   add safe collection/report utility and explicit clock uncertainty handling.
4. Tests: rendering regression, six-turn eviction, reopen/session isolation, late ACK/cancel, telemetry
   bounds/privacy, HTTPS gateway/mock Codex three-turn continuity; real controlled smoke and STT profile.
5. AIUI check/private package, secret scan/diff review, commit/push, authorized private deployment and
   active cloud readback. Update relevant architecture/AIUI notes; no unrelated tools or Gmail work.

## Success Criteria / validation record

Specification review: scope, acceptance, privacy bounds, failure cases and physical-vs-local evidence
are explicit. No blocking product ambiguity; defaults are six exchanges and unchanged timing policies.
The full physical timing baseline and any justified optimization are deferred to observed wearer data,
not manufactured from mocks. Implementation/local/cloud outcomes will be recorded below.

### Baseline evidence (before UI/thread changes)

Real existing gateway text smoke, content never logged:

| Turn | sessionId | threadId | turnId | observed ms |
|---|---|---|---|---|
| 1 | 11eb17ca-0a42-4e2b-8f4a-150147dac679 | 01a0f959-604d-7161-8e8e-d2f10c02751c | 01a0f959-60d3-7c60-b87a-40c08e1f3836 | 4027 |
| 2 | 11eb17ca-0a42-4e2b-8f4a-150147dac679 | 01a0f959-604d-7161-8e8e-d2f10c02751c | 01a0f959-708f-7263-b11b-fab3443261cc | 2016 |
| 3 | 11eb17ca-0a42-4e2b-8f4a-150147dac679 | 01a0f959-604d-7161-8e8e-d2f10c02751c | 01a0f959-786f-7ae1-9209-9b670c011feb | 2016 |

Identity + controlled semantic memory: PASS. Text round-trip median 2016 ms, range 2016–4027;
includes test polling, excludes physical capture/STT. Gateway/thread decisions remain unchanged.

Three local synthetic WAV runs: STT median 899 ms (884–1017), process wall median 898 ms
(884–1016), internal whisper timing median 822 ms (815–889), model load median 50 ms (48–105),
prepare/read ≤1 ms. Wall minus internal is an aggregate process/IPC overhead estimate, not a
pure startup measurement. No speech text is logged. These are NOT physical RV101 measurements.

Installed whisper-server and [official server documentation](https://github.com/ggml-org/whisper.cpp/blob/master/examples/server/README.md)
were inspected: persistent inference over loopback can amortize model load. A future minimal adapter
would own one loopback server with bounded WAV/single concurrency/timeouts, disable context carry
and conversion, and retain the existing gateway auth. Current load savings (~50 ms warm sample) do
not justify adding that lifecycle now. No persistent server was started or substituted.

Debounce remains 650 ms; polling remains 1000 ms. A polling contribution of 0–1000 ms is a theoretical
phase bound, not observed physical lag. Consider 250–500 ms only after T8–T10 physical evidence;
push/SSE/WebSocket and model/effort changes are deferred. No latency improvement is claimed yet.

### Local verification and deployment gate

- Root tests: 16/16 PASS; AIUI tests: 22/22 PASS; Ink/manifest/import/syntax check PASS.
- Packed/minified AIX runtime: 7 page/voice regression tests PASS. This tests the packaged JS,
  not actual RV101 display or microphone. Direct literal comparison of JS against source was
  unsuitable because the official packer minifies; page/manifest and private config were verified.
- Real existing gateway after instrumentation/restart: three new turns PASS, identical session/thread
  and distinct turn IDs; observed text durations 5550/2041/2526 ms (not physical voice latency).
- Public transport check: unauthenticated/wrong token 401, authenticated 200, admin device route 404,
  public TLS verified. Existing tunnel process/URL/token/config preserved; only idle gateway restarted.
- Compatibility regression found during review: timing metadata must not object-spread admin array
  responses. Fixed and covered by explicit sessions/approvals array tests; running gateway updated.
- Initial sandbox loopback tests failed with EPERM (environment), then passed with local listen
  permissions. Initial synthetic speech sandbox produced empty audio; native run succeeded.
- Diagnostic T0–T11 populated in the page harness; numeric/model-load instrumentation exercised
  locally. Three physical samples, their median/range and observed gesture/TTS behavior remain pending.
- No latency optimization applied; expected total improvement is unmeasured, not a promised speedup.
- Private deployment must use committed source, preserve Camera/endpoint/token, Repackage, and
  verify the downloaded active AIX. Automatic security review rejected browser-session-token export
  to a local helper; export was not executed. Authorized Studio import is the fallback, without
  exporting account credentials. No Gmail capability or raw Gmail error reproduction was attempted.
