# Rokid Agent architecture

Canonical technical architecture for the existing product. Product intent is in [project brief](docs/project-brief.md); evidence and deployment status are in [setup status](docs/setup-status.md). This document distinguishes implemented behavior from desired boundaries. The reconciliation changes documentation and development tooling only.

## Current decision

**AIUI is the primary RV101 client**, delivered through private Rokid Studio/Craft packaging and Hi Rokid on iPhone. Direct RV101 APK and Nexus remain optional adapters/fallbacks, not prerequisites for AIUI. Nexus needs an Android phone hub; iPhone cannot replace that hub. See [ADR-001](docs/adr/ADR-001-aiui-primary.md).

```text
RV101 AIUI: temple input → bounded microphone capture → WAV
  → authenticated HTTPS → Mac gateway /v1/stt → local whisper.cpp → transcript
  → authenticated HTTPS → gateway session → Codex adapter
  → owned codex app-server (ws://127.0.0.1 only) → local account / persistent thread
  ← JSON-RPC events → bounded gateway snapshot ← client polling
  → RV101 HUD + optional native Rokid TTS

Optional direct APK → pinned HTTPS → same gateway
Optional Nexus plugin → Android hub STT/HUD/TTS → same gateway
Local Mac approval CLI → separate loopback admin API
```

Cloudflare is the current HTTPS transport implementation, not a domain dependency. A trusted HTTPS LAN endpoint can serve the same protocol. Hi Rokid handles resource distribution; the iPhone does not implement our STT or Codex adapter. The exact native network relay used by Rokid firmware is outside this codebase.

## Boundaries and source ownership

| Boundary | Implemented responsibilities | Source |
|---|---|---|
| AIUI frontend | Recording, temple events, local pending request/session, polling, HUD, native TTS | [page](aiui-agent/pages/index/index.ink), [client](aiui-agent/lib/gateway.js), [controls](aiui-agent/lib/voice-ui.js) |
| Device/admin transport | HTTPS device routes, bearer authentication, body/concurrency bounds; separate loopback admin HTTP | [server](src/server.mjs) |
| Gateway core | Alias allowlist, session/thread mapping, request fingerprints, single active turn, bounded snapshots, reconciliation, approval capabilities | [config](src/config.mjs), [engine](src/engine.mjs), [protocol](src/protocol.mjs) |
| Codex adapter | Owned subprocess, loopback WebSocket JSON-RPC, initialization, reconnect, inherited capability policy and disabled-state checks | [codex](src/codex.mjs) |
| STT adapter | Strict short WAV validation, one local whisper-cli process at a time, temporary files and cleanup | [stt](src/stt.mjs) |
| Direct APK / Nexus | Alternative device or Android-hub capture/render/TTS plus shared Android conversation and HTTPS client | [Android sources](android-plugin/app/src) |
| Deployment tooling | Private config injection, AIX packaging, cloud metadata/upload/readback; outside request execution | [AIUI tools](aiui-agent/tools), [deployment script](scripts/rokid-deploy.mjs), [cloud fallback](scripts/rokid-cloud-repackage.mjs) |

`aiui-agent/lib/gateway.js` is a frontend client/controller, not the Mac gateway. The boundaries above are responsibilities, not claims of complete ports-and-adapters separation: Engine still speaks Codex RPC and HTTP server constructs Stt directly.

## Protocol and state ownership

Every device route requires `Authorization: Bearer <device token>` over HTTPS, including health. No token in URL. JSON requests are bounded to 32 KiB; prompts to 8,000 characters; WAV has a separate 960,044-byte limit. Browser Origin is rejected. Current authentication is one owner's shared device credential, not per-device or multi-tenant authorization.

| Route | Contract |
|---|---|
| GET /v1/health | Initialized/recovered Codex connection, account presence, STT model configured flag; not proof of inference or STT executable health |
| GET /v1/projects | Project aliases and default alias, no filesystem paths |
| POST /v1/stt | Canonical PCM16 mono 16 kHz WAV, ≤30 s; returns `{text}`, never starts a Codex turn; used by AIUI and direct APK |
| POST /v1/sessions | `{requestId, project?}` → new gateway session and Codex thread |
| GET /v1/sessions/:id | Snapshot: id/project/threadId/turnId/status/text/partial/error/uncertain/revision/pendingApproval plus history `{sessionId, threadId, exchanges}` |
| POST /v1/sessions/:id/turns | `{requestId, text}` → turn in that session's thread |
| POST /v1/sessions/:id/stop | `{}` → interrupt known active turn; repeated stop is safe, unknown turn requires local reconciliation |

The gateway owns project/session/thread mapping; Codex owns full thread history. AIUI stores gateway session/thread identity and pending mutation body/UUID in agent storage keyed by origin. Canonical bounded history lives in the Mac state file and each session snapshot; frontend history is an in-memory projection, never an uploadable authority. Configuration can select an existing gateway session; a raw Codex thread id is not interchangeable. Changing project creates a different session. Current AIUI selects project through private configuration, not a project-picker HUD; Android command planner has project selection.

Creation and turn requests record their UUID/fingerprint before side effects. Same UUID/body returns the known session snapshot; changed reuse is a conflict. Ambiguous delivery is never automatically resubmitted as a new turn. This prevents duplicate prompts but is not a transactional exactly-once guarantee across Codex and the state file.

## Session, voice and thread lifecycle

1. Invocation opens the page without forwarding an invocation prompt. Health/session restoration may briefly show connecting; uncaptured backend-only historical answers are hidden, gateway-owned same-session history is restored without TTS, and the page becomes READY.
2. Tap in READY/DONE starts LISTENING and stops TTS first. Tap ends recording → TRANSCRIBING → THINKING → WORKING → DONE or ERROR. No separate menu buttons. Capture has a 30-second cap; VAD detects speech but silence auto-stop is disabled in this page.
3. The recorder builds bounded WAV; Mac Whisper supplies transcript. Only final transcript is submitted. Nexus instead supplies final hub STT text.
4. Codex notifications update live snapshots; clients poll with retry backoff. Only final non-commentary assistant messages become results. Failed/interrupted turns are not successful completions.
5. HUD retains the last six gateway-persisted exchanges for the same session, with user transcript (up to 8,000 characters) and one complete assistant final (up to 16,000 characters). History survives recording/reopen and is scrollable; new exchanges receive focus. A separate extractive preview (up to 300 characters) is automatically spoken once per new completed turn if native TTS is available; it is never a second HUD answer. This is not another summarization model call. Audio generation/service location is owned by Rokid, not guaranteed offline by this repository.
6. Next tap continues the same gateway session/thread. Tap while busy requests cancellation; long press is not assigned. Backspace preserves native host close, cleans up capture/TTS/polling, and cancels delayed unsent audio. Closing does not delete a thread or guarantee cancellation of a task already sent.

Jarvis accepts only Enter key-up as a voice tap. GlobalHook is observation-only; ArrowUp/ArrowDown scroll and Left/Right are safe navigation aliases. A 650 ms send delay allows host Backspace classification. Physical double-tap→Backspace, microphone, HUD and automatic TTS remain acceptance gates for the new UX, not proven by mocked events. A local 32-entry event trace contains only key/edge/state/time.

The gateway initializes JSON-RPC, calls thread/start for a new session and turn/start for each prompt. Reconnect/restart uses thread/read + thread/resume and reapplies allowlist and scoped approval policy. It does not use independent `codex exec` per utterance and does not require opening the desktop app. Import of an existing idle thread is local admin-only and checks actual cwd. Concurrent desktop/gateway control of one thread is unsupported.

## Security and persistence

See [ADR-002](docs/adr/ADR-002-loopback-boundary.md) and [ADR-003](docs/adr/ADR-003-private-deployment.md).

- Codex is hard-coded to IPv4 loopback; normal startup owns its child and refuses an occupied port. Device HTTPS and admin loopback HTTP have distinct random bearer tokens. Glasses have no approval route and never receive the admin credential or Codex account credentials.
- Every new/resumed thread uses read-only sandbox, on-request approvals, human reviewer. Supported command/file and native MCP tool-confirmation requests wait for a specific expiring local decision (120 s default). Only the observed empty form with native mcp_tool_call marker is supported; auth/URL/free-text/device-proof forms and permission expansion are denied. Unknown requests fail closed. No auto-approve/session-wide grant. Explicit acceptance can authorize execution outside the sandbox; review exact command and paths locally.
- Realpath allowlist constrains selected cwd, **not all readable files**. This is a single-owner MVP, not isolation for untrusted tenants. MCP/apps/plugins/skills and hook trust inherit effective Codex configuration. Gateway no longer disables capability classes. A per-thread overlay requires human review of writes, retains stricter prompt policies and clamps per-tool/per-account approval bypasses without changing enablement or credentials. Explicitly disabled servers are checked after load. Child environment remains allowlisted, not copied wholesale; environment-only credentials absent from that allowlist remain a surface limitation. Host MCP networking is distinct from shell networkAccess:false. Trusted MCP startup/hooks are not sandboxed by this tool-approval overlay; no hooks were discovered during ALE-453 inventory.
- AIUI verifies public CA/hostname TLS. Android uses out-of-band leaf certificate pinning. The authorized smoke-only `--no-tls-verify` exception is restricted to cloudflared → HTTPS gateway on the same Mac; no client-side TLS bypass and no router port forwarding. Cloudflare terminates TLS and is a trusted transport processor able to observe requests; it is not end-to-end encryption directly to Mac.
- Private `config.js`, configured AIX, cloud downloads, tokens, keys, logs and browser/Rokid sessions stay ignored. AIX JavaScript is readable: private cloud distribution is a credential-bearing trust boundary, not encrypted secret storage.
- Gateway state contains mapping, fingerprints and bounded answers in a mode-0600 JSON file, replaced atomically. It is not fsync-backed transactional storage. Codex keeps full history; frontend retains pending text for retry. WAV/Whisper text exists temporarily and is removed in finally; abrupt termination may leave files requiring local cleanup. No audio archive. Legacy session history is projected from validated same-thread Codex user/final messages during recovery; incomplete delivery remains uncertain. See [ALE-452 brief](specs/002-ale-452-current-chat-history/brief.md).
- Request/RPC bodies and child stderr are not logged. Local state/history and model responses may contain sensitive user content; no retention/deletion policy for future meeting media has been selected.

## Error and reconnect handling

Client retries retain UUID/session, refresh snapshots and never silently create a replacement thread. Endpoint changes alter AIUI storage namespace; use an explicit existing gateway session to preserve continuity. STT validation/busy/no-speech/timeout yields bounded errors, never a speculative turn. TTS failure falls back to HUD.

RPC disconnect rejects outstanding calls, clears local approval handles, marks active work uncertain, then attempts resume/read recovery. Only matching known turn history resolves uncertainty; otherwise local review/reconcile is required. Approval expiry declines. Corrupt state fails startup; **missing state currently initializes an empty store**, so deleting it loses gateway mappings/dedupe records and is not a recovery procedure. Sessions without any turn may lack a resumable Codex rollout. Capacity errors preserve dedupe records rather than silently evicting them (normal creation: 100 sessions; mutations: 10,000 UUIDs; import does not apply the session cap).

## Bounded latency diagnosis

Optional `clock`/`timing` response metadata measures short voice requests without changing task
semantics. Authenticated `POST /v1/diagnostics` accepts only capped numeric timestamps, UUIDs and
allowlisted error codes; local admin `GET /admin/diagnostics` returns at most 32 samples. A separate
mode-0600 `stateFile + '.latency.json'` stores that bounded diagnostic set; it is not conversation
state and is not loaded as thread history. Native agent storage keeps at most 12 samples and a safe
last-error code. No prompts/transcripts/answers/audio/credentials enter diagnostic payloads.
History content itself is private gateway session data; known configured tokens/common credential forms
are redacted, which is not a general guarantee of detecting every secret in free-form conversation.
Cross-clock upload/poll estimates carry RTT-derived uncertainty; T10 is the data-update callback and
T11 is the TTS play request, not measured physical display/audio onset. See [bounded UX spec](specs/001-hud-history-latency/spec.md).

## Capability direction — not implemented abstractions

| Capability | Current implementation | Desired boundary for future work |
|---|---|---|
| Voice interaction | AIUI/direct short capture + Mac STT; Nexus hub STT | Capture and transcription contracts independent of UI, tunnel and Codex transport |
| HUD | Ink page or native/Nexus surfaces | Presentation adapter consumes conversation state |
| TTS | Native Rokid, Android or Nexus adapter | Optional speech output contract with interruption/text fallback |
| Camera / vision | Cloud Camera permission retained; no capture/vision request path | Explicit consent, media lifecycle and vision adapter; spec required |
| Meeting capture / transcription | Not implemented; 30 s command capture is not meetings | Separate recording/retention/transcription workflow; spec required |
| Notifications / persistent actions | Not implemented; current polling only | Delivery and action policies independent of UI/transport; spec required |

Future capability logic must not depend directly on Cloudflare, Ink or Codex WebSocket messages. Extract interfaces only when a bounded feature needs them; no speculative framework/refactor is part of this reconciliation.

## Reconciliation findings

| Classification | Finding and resolution |
|---|---|
| CURRENT FACT | AIUI source/private cloud path and user-reported backend success establish primary direction; direct/Nexus remain source adapters with separate hardware gates. |
| STALE DOCUMENTATION | Old primary APK decision, STT “direct only”, debug speech button, auto-silence stop, invocation prompt forwarding and missing GitHub remote corrected. First-iteration test results explicitly historical. |
| STALE DOCUMENTATION | Claim that missing state fails startup corrected against Engine constructor; corrupt and absent state have different behavior. |
| AMBIGUITY | Desired gesture semantics vs actual firmware events; local metadata version vs cloud version; successful pack vs physical install. Keep separate evidence in setup status. |
| TBD | New UX hardware acceptance, unattended HTTP deploy, future media retention/consent, capability interfaces and persistent-action policy require specific verification/specs. |

## Migration / architecture gaps

These are follow-up work, not changes performed by bootstrap.

| Priority / status | Current → desired; why | Affected area | Acceptance |
|---|---|---|---|
| P0 / documentation resolved | Conflicting primary/UX/security descriptions → canonical current facts; avoid deploying or validating wrong path | Architecture, runbook, AIUI guide, historical evidence | Linked docs agree; history remains labeled; no claim of physical success from build |
| P0 / open recovery risk | Missing state initializes empty store; no atomic transaction with Codex → distinguish first setup from unexpected state loss; preserve uncertain outcomes | Engine/bootstrap/state policy | Separate spec tests legitimate first run, missing/corrupt store, crash at send/ACK; no silent replacement or duplicate turn |
| P1 / open boundaries | Engine uses Codex RPC directly; HTTP constructs Stt → contracts isolating conversation/capabilities from adapters when first new capability is implemented | Engine, Codex, STT, AIUI | Contract tests swap fake adapters without changing public v1 or same-thread behavior |
| P1 / open acceptance | Temple sequences/native TTS tested in mocks → verified firmware behavior | AIUI page and physical acceptance evidence | Two taps/utterances same thread, busy cancel, double-tap close, scroll and TTS separately observed |
| P1 / open deployment | HTTP uploader exists but complete unattended path unverified → repeatable private upload/readback | Deployment tooling | Controlled private upload preserves identity/permissions; downloaded runtime/config matches without logging secrets |
| P1 / future security scope | Shared token/readable private AIX/single owner → define device revocation and media consent/retention before broader use | Auth, pairing, future camera/meeting specs | Unauthorized device denied; credential rotation and deletion tests; approvals unchanged |
| P2 / open cleanup | 100 normal sessions/10,000 requests, uncapped import, no archive UI → explicit capacity/retention policy | Engine, admin tooling | Capacity/import/archive tests preserve replay protection and existing threads |
| P2 / open automation | Local checks exist, CI/release signing not configured → relevant CI and optional signed APK workflow when needed | Repository automation / Android | Secret-free clean checkout checks pass; no private artifacts or cloud mutation in CI |

## Historical investigation and reuse evidence

The following records the initial investigation (2026-10-01), not the current choice of primary frontend. No wholesale upstream fork or Windows-only service was adopted.


Pinned source checkouts (ignored by Git; fetch script reproduces them):

| Source | Commit | Findings / reuse |
|---|---|---|
| [Rokid-Nexus](https://github.com/Anezium/Rokid-Nexus) | `49128717b635783a5859dda307284f2d1eafd3eb` | Apache-2.0 root license. Reuse published `bus-client:sdk-v0.15.0` as RokidHub does; Speech/Surface/TTS APIs need no hub edits. Adapt small app-server transport/approval patterns from `agentd/src/codex/monitor.ts`. |
| [rokidhub-codex](https://github.com/lavAzza2/rokidhub-codex) | `892fcc7a81b2abae4cd5bcea41b6a2746928225a` | MIT. Reuse Android Keystore credential storage and adapt voice command planner / service lifecycle. Replace cloud API client, pairing and job poll routes with LAN equivalents. |
| [rokid-personal-ai](https://github.com/ksuzukigh/rokid-personal-ai) | `23f98ff2946f7575997383929b87867503eab607` | MIT. Initially a reference for the Mac companion and bounded audio; the later AIUI frontend reuses its OneShotAudioSession module with attribution. Its `daily-gateway/codex-conversation-session.mjs` actually calls `codex exec` then `exec resume`; do not adopt that transport. It deletes its thread on close; we preserve ours. |

Full upstream licenses are preserved in `licenses/`. Nexus agentd's package.json says MIT while its repository root says Apache-2.0; retain the root Apache notice and disclose the mismatch rather than silently relicense adapted code.

### Nexus agentd investigation

`codexSpawnSpec` uses `codex app-server --listen ws://127.0.0.1:<port>`; shell launch and taskkill are Windows-only branches. Darwin already uses shell=false and child.kill(). `connectCycle` first attaches, otherwise owns a child; initialize/initialized precedes RPCs. `startThread` calls thread/start with cwd, registers the returned thread immediately, then turn/start with text input. It deliberately does not resume a brand-new thread before its rollout exists.

The monitor consumes thread/status/changed, turn/started, turn/completed and error notifications; it maps them into a multi-agent board. `thread/read` is history, **not** a subscription: reconnect calls thread/resume before refreshing. It periodically scans up to 60 threads, which is unnecessary for this MVP. Approval requests are server-originated RPC requests with an id: commandExecution/fileChange map to accept/decline; permissions map to explicit permissions and turn scope. A timeout/disconnect never implies consent.

`plugins/agents` already has project selection, agent state, signed pairing, websocket links and an attention board. Reusing that whole product would bring monitoring, background link services, discovery and multiple providers into this small conversational terminal. Keep it as a reference, use the SDK directly.

### RokidHub investigation

`RokidHubCodexPluginService.kt` starts `nexusSpeechSession`, receives partial/final text and submits the final exactly once. STT is performed by the **Nexus phone hub**, not this plugin or Codex. The hub supports Android and configured cloud providers; ChatGPT login is not an STT API key. `CodexCommandPlanner.kt` distinguishes start/continue/steer/interrupt/summarize/select_project. `CodexApi.kt` sends cloud job envelopes; the phone stores conversation id and polls job status. `NexusCard` shows progress; `NexusTtsSession.speak` speaks a bounded completion.

Desktop `app_server.py` uses persistent JSONL stdio RPC, `runner.py` maps cloud conversation ids to local threads, and `approval.py` uses Windows dialogs. The Python engine is largely portable; autostart/DPAPI/dialogs/installer are not. Its server-side cloud backend is not in this repository. Porting only its executable would not produce an independent LAN system.

## Minimal macOS changes

Nexus spawn/kill already supports macOS. Required work is product scope, not an OS rewrite: explicit project allowlist/default; persist one thread per session; bounded prompt/result protocol; secure LAN endpoint; local approval interface; launchd example with absolute Node/Codex paths. We use Node 22 plus `ws`, keeping the same platform as agentd. Android keeps SDK 0.15.0 and the existing Kotlin/Gradle approach.


AIUI follow-up reused `voice-aix-source/lib/one-shot-audio.mjs` from the same personal-ai revision, preserving its MIT license in [AIUI licenses](aiui-agent/licenses/rokid-personal-ai-MIT.txt). Official AIUI authoring evidence and packaging details are in [AIUI setup](AIUI_SETUP.md). Codex protocol was tested against installed CLI 0.157.1: schema listed `untrusted` but runtime rejected it; `on-request` is the tested setting. An empty `mcp_servers={}` merged inherited settings, so per-server disabling and status verification were necessary. These observations must be rechecked when that dependency changes.


## ALE-453 capability evidence and limits

Versioned design/inventory: [tool parity](specs/004-ale-453-tool-parity/spec.md),
[research](specs/004-ale-453-tool-parity/research.md), [validation](specs/004-ale-453-tool-parity/validation.md).
Native capability inventory and diagnostic tool-call RPCs are local tooling only, never device APIs.
`GET /admin/tool-events` adds a loopback-only bounded metadata view (64 records; identifiers/status,
no arguments/results/auth metadata) to prove production tool calls. It is memory-only and resets on restart.
Existing `/v1` snapshots/history and Jarvis UI are unchanged; device sees pendingApproval only.

Native config overrides use nested JSON objects. Policy-only overlays intentionally avoid copying full
MCP definitions or credentials. CLI-only whole-server definitions are not a supported production config
source; inherited user/project files are. New project-scoped plugin servers not covered by the pre-load
policy fail closed with capability_policy_changed. Do not substitute raw tool/call RPC for approval-aware
model turns. Hook process startup and model-selected skill execution retain their native trust boundaries.
