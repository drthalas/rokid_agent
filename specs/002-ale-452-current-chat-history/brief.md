# ALE-452 — Gateway-owned current-chat history

Canonical task/status: [ALE-452](https://linear.app/drthalas/issue/ALE-452).
Scope: bounded history/rendering repair; no tool parity, multi-chat, credentials or timing-policy changes.

## Observed / expected

Physical feedback: voice/TTS works, but HUD renders empty Ты:/Codex: labels. Prior source uses
`wx:for`/`wx:if`; official AIUI list/conditional docs specify `ink:for`/`ink:if`.
Expected: visible user/final-assistant text once per exchange; three turns remain readable and scrollable.
Mac gateway owns the canonical bounded history; device storage cannot overwrite it.

## Acceptance

- Snapshot exposes last six exchanges, bounded user (8000 chars) and final assistant (16000 chars).
- History is persisted atomically with existing session state. Same sessionId/threadId, distinct turnIds.
- Reopen/fresh frontend storage + configured existing session restores gateway history without re-speaking
  old answers. A session mismatch is rejected; histories never merge across sessions.
- Legacy state without history is rebuilt from validated same-thread `thread/read` history during recovery;
  preserve stored request IDs where available. No replay/new thread as a migration shortcut.
- Record submitted question before turn/start, attach returned/event turnId, keep incomplete/error question
  without inventing an assistant final. Deduped/lost ACK cannot add another exchange.
- Unknown delivery/recovery remains uncertain: hydration is display-only and never authorizes another turn.
- Use supported Ink directives, one assistant text binding, six-entry cap, newest exchange focus and scroll.
- Keep tap/TTS/Camera, endpoints/tokens, sandbox/approvals/MCP isolation and latency behavior unchanged.
- No content in diagnostics/logs/Linear. Gateway state remains private; redact known device/admin token
  values and recognizable credential forms before persistence/exposure, without claiming universal DLP.

## Plan / components

1. Validate Ink directive evidence and add regression rejection of unsupported wx directives.
2. Add bounded gateway history to Engine lifecycle/recovery; extend existing snapshots additively.
3. Frontend accepts authoritative snapshot history; pending request remains durable for idempotent retry,
   but is not an independent transcript store. Reject missing history on an outdated gateway visibly.
4. Tests: three turns, six-turn eviction, duplicate UUID, late completion, restart/legacy hydration,
   fresh frontend reopen, isolation/redaction, visible user/answer bindings and preserved gestures/TTS.
5. Run root/AIUI checks + private AIX validation, inspect diff/secrets, commit/push referencing ALE-452.
   Record readiness as Needs Test. Physical acceptance requires wearer confirmation on the deployed build.

## Risks / migration limits

Codex history item schema varies; only userMessage.content text and final non-commentary agentMessage
are projected, no tools/reasoning/logs. Bound the last six turns; do not claim full archival chat retrieval.
Legacy empty threads can lack rollout as before. Bounded state migration is additive (v1 optional field),
with current state preserved; no destructive migration. Frontend and gateway should be deployed together.
Prior JS harness checks did not exercise native template iteration, so static supported-directive checks
and visible-text fixture assertions are required; final physical proof remains separate.

## Validation record

Local implementation verified; physical acceptance pending in Linear.

- Root tests 19/19, AIUI tests 24/24, AIUI manifest/Ink/import/syntax validation: PASS.
- Official AIUI documentation at reference commit b1e9ff620b41b306bd50ef87d401f32d6c57edb5
  specifies Ink directives. Added a build guard rejecting the old wx control attributes and a
  regression checking supported loop/conditional directives plus user/assistant text bindings.
  These checks do not claim native RV101 rendering proof.
- Real isolated Codex: session bf65f55a-ed00-474f-a4b8-f99fdc68f4b9,
  thread 01a0fc61-e58f-7f40-a795-7f2deb53512b; three distinct turn IDs, semantic context and
  exchange counts 1/2/3 PASS. Full gateway/app-server restart after turn 2 and legacy backfill
  after turn 3 both PASS. No speech/answer content emitted by the smoke script.
- Private source 0.3.1 packaged separately as ignored `dist/mac-codex-aiui-ale-452-private.aix`;
  packaged/minified page + voice regressions 7/7 PASS. Original config/tokens/tunnel unchanged.
- Deployment readiness only: running gateway and active cloud version were not changed by ALE-452.
  Coordinated gateway update + private upload/Repackage/readback precede physical acceptance.
- ALE-453 remains a separate security-sensitive Spec Kit task. ALE-454 stays Backlog until both
  current history and tool parity have physical acceptance.
