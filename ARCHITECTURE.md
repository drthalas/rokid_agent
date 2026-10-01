# RV101 → local Codex: first iteration

Investigation: 2026-10-01. Scope: interactive voice commands only; no meeting recording.

## Decision

**Updated after the user confirmed an iPhone:** Nexus requires an Android phone, so it cannot be the primary path for this user's hardware. Deliver two Android product flavors sharing the same gateway client and conversation logic: `direct` is installed on RV101 itself (AudioRecord → bounded WAV upload → whisper.cpp on Mac; native HUD and optional Android TTS); `nexus` is the optional headless plugin for a future Android/Nexus setup. iPhone is not in the data path. The direct app uses the one-shot PCM pattern and native launcher/HUD reference from rokid-personal-ai, but does not depend on its unpublished AIUI scene code.

```text
RV101 direct APK → mic PCM16 WAV (≤30 s) → pinned HTTPS POST /v1/stt
  → whisper.cpp on Mac → transcript → POST /v1/sessions/:id/turns
  → same gateway / same Codex thread → RV101 native HUD / optional device TTS
```

The APK exposes the recognized text as the Thinking state before the Codex result. Raw audio is bounded, stored only in a private temporary directory during recognition and removed in a finally block. An abrupt power loss may leave a temporary directory; see cleanup in RUNBOOK. This is short command capture, not meeting transcription.

For the optional Nexus flavor, keep the runtime and its typed plugin SDK. Build a small, dedicated LAN gateway using the app-server lifecycle from Nexus agentd, and a headless Nexus phone plugin using the voice interaction pattern from RokidHub Codex. Do not fork or rewrite the hubs, implement speech engines, port the Windows GUI, or introduce the private RokidHub cloud backend.

```text
RV101 microphone / launcher / HUD / speaker
    ↕ existing Nexus glasses hub ↔ existing Nexus Android phone hub
Nexus phone plugin: SpeechSession → text, SurfaceSession, TtsSession
    ↕ HTTPS + pinned certificate + separate device bearer token (LAN)
Mac gateway: project aliases, session state, bounded result snapshots
    ↕ JSON-RPC WebSocket on ws://127.0.0.1:8390 ONLY
owned codex app-server → existing local Codex authentication and thread store
```

**The phone is required by this Nexus architecture.** “Launch on glasses” means opening the phone plugin through the glasses launcher. It does not mean installing this plugin APK on RV101. The direct-to-Mac AIUI route in rokid-personal-ai is a different implementation with unpublished device pieces.

## Evidence and reusable components

Pinned source checkouts (ignored by Git; fetch script reproduces them):

| Source | Commit | Findings / reuse |
|---|---|---|
| [Rokid-Nexus](https://github.com/Anezium/Rokid-Nexus) | `49128717b635783a5859dda307284f2d1eafd3eb` | Apache-2.0 root license. Reuse published `bus-client:sdk-v0.15.0` as RokidHub does; Speech/Surface/TTS APIs need no hub edits. Adapt small app-server transport/approval patterns from `agentd/src/codex/monitor.ts`. |
| [rokidhub-codex](https://github.com/lavAzza2/rokidhub-codex) | `892fcc7a81b2abae4cd5bcea41b6a2746928225a` | MIT. Reuse Android Keystore credential storage and adapt voice command planner / service lifecycle. Replace cloud API client, pairing and job poll routes with LAN equivalents. |
| [rokid-personal-ai](https://github.com/ksuzukigh/rokid-personal-ai) | `23f98ff2946f7575997383929b87867503eab607` | MIT. Reference only: Mac companion, bounded per-turn audio, explicit effects, conversation continuity. Its `daily-gateway/codex-conversation-session.mjs` actually calls `codex exec` then `exec resume`; do not adopt that transport. It deletes its thread on close; we preserve ours. |

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

## Wire protocol v1

HTTPS JSON, UTF-8, max JSON request 32 KiB; the direct audio endpoint separately accepts canonical WAV up to 960044 bytes. `Authorization: Bearer <device token>` on every /v1 route. Token is generated on the Mac; transferred manually into a secure phone settings screen. Certificate SHA-256 is pinned out of band; never accept an arbitrary self-signed certificate. No credentials in URL, APK build flags, access logs or HUD.

| Route | Meaning |
|---|---|
| GET /v1/health | Live initialized Codex connection and login availability |
| GET /v1/projects | Aliases + default; no filesystem paths |
| POST /v1/stt | Direct RV101 only: canonical mono PCM16/16 kHz WAV, 30 seconds max; returns `{text}` without starting a Codex turn |
| POST /v1/sessions | `{requestId, project?}` creates new thread/session; defaults to configured project |
| GET /v1/sessions/:id | Current snapshot: threadId, turnId, status, text, error code, pendingApproval, revision |
| POST /v1/sessions/:id/turns | `{requestId, text}` sends one prompt in the existing thread |
| POST /v1/sessions/:id/stop | Interrupt active turn; safe to repeat |

Device polls snapshots while open (1 s, exponential retry to 10 s). App-server deltas update the current snapshot. Snapshots avoid missed-event problems after reconnect; text/revisions are bounded. Only final assistant messages count as final results; failed/interrupted turns are not labeled successful. Summary is an ordinary prompt in the same thread. Project selection starts a different session, never changes cwd of the existing thread. Request UUIDs are durably remembered; mismatched reuse is a conflict. Ambiguous turn/start delivery is never automatically replayed.

## Session and thread lifecycle

Plugin open → health check → restore saved session or create → ready. Tap → Listening → one final transcript → Thinking → Working → Done/Error. Additional tap accepts a follow-up into the same session and thread. Stop interrupts; closing HUD stops microphone/TTS/polling but preserves the Mac thread and running task. On reopening, read snapshot before starting any recording. STT partials never start a turn. TTS stops before listening to avoid feedback.

Gateway atomically stores session/thread/project mapping, last bounded result and request fingerprints in a mode-0600 state file. Only a single turn per session is allowed. A restarted gateway resumes known threads using the allowlisted canonical cwd and reapplies its policy. An interrupted/uncertain request remains visibly uncertain until recovery; no duplicate prompt replay. Local-only import of an existing idle thread checks its actual cwd against the allowlist first. Do not concurrently drive a thread from Desktop and this gateway; the MVP does not take over a live Desktop turn.

## Security model

Codex has a hard-coded IPv4 loopback listener. The external gateway is separate HTTPS. Separate random device/admin tokens; admin API is on an additional 127.0.0.1-only listener. Glasses cannot approve actions. All sessions use read-only sandbox, on-request approvals and human reviewer; there is no auto-approve path. Command/file approval needs a specific local decision with an expiring id; permission expansion and unsupported server requests are denied. No persistent “allow all” or exec-policy amendments.

Allowlist resolves real directory paths; client provides only an alias. This controls **project routing**, not an assertion that Codex can never read another local file. The Codex read-only sandbox can read outside cwd; explicit approval may allow execution outside the sandbox. Do not grant a command without examining its exact content. Gateway disables inherited MCP servers/apps/plugins/hooks where supported and does not pass device/admin secrets in the Codex child environment. Local Codex credentials remain in the existing Codex home, never sent to the phone. Prompt/response content can contain user secrets, so gateway logs only fixed operational codes and does not log RPC bodies or child stderr.

## Failure and reconnect

Network loss: plugin retains session and request UUID, reconnects to snapshot; never invent a new thread. STT busy/revoked/no speech/link loss produces Error and requires a fresh tap. Gateway RPC timeout/disconnect rejects pending RPCs, clears local approval capabilities and marks active work uncertain. Reconnect resumes and reads history; it never starts the old prompt again. If history cannot establish completion, stop/reconcile is required before another turn. Approval expiry declines. Unknown server requests fail closed. Gateway restart retains ids; missing/corrupt state is a startup error, not a silent reset.

## Validation boundaries

Unit tests cover protocol/state, allowlist and approvals; integration tests use an actual loopback mock app-server and HTTPS gateway. Real smoke uses installed Codex and two turns in the same local thread plus resume. Hardware acceptance requires a paired RV101/Android Nexus system, configured STT provider, Android SDK/JDK and installation of the built APK. An unbuilt/uninstalled source plugin is not evidence that the hardware path works. Results and remaining gaps are recorded in RUNBOOK.md and TEST_RESULTS.md.

Protocol authority: installed `codex-cli 0.157.1` generated schemas, compared with [official App Server documentation](https://learn.chatgpt.com/docs/app-server). Runtime testing found `untrusted` still in generated schemas but rejected by this binary, so use `on-request` with read-only sandbox and user approvals. Empty `mcp_servers={}` merges inherited entries; config/read resolves each project cwd and enumerates its servers; each thread/start/resume disables them by name. mcpServerStatus/list then verifies every server is disabled with zero tools, otherwise the session fails closed. No account-token exchange service is added: use existing local Codex login.
