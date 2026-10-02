# ALE-461 — Jarvis physical UX polish

Canonical task: [ALE-461](https://linear.app/drthalas/issue/ALE-461).
Baseline: 75ac72c. Gateway/Codex, credentials, protocol/session identity, Camera and ALE-453 are out of scope.

## Accepted mapping (user revision 2026-10-02)

The mandatory physical input probe is explicitly cancelled as a release gate. Official page-event
semantics plus wearer evidence are sufficient for this repair: GlobalHook is generic temple contact,
including swipe onset, and must never invoke voice/cancel actions. Enter onKeyUp is the host-classified
single tap. ArrowUp/Down scroll only; Left/Right are navigation aliases. Backspace retains native exit.
No two-finger event is used for core control. Probe remains an optional tool, excluded from default AIX.
No raw physical trace is claimed to have been collected by Codex.

## Expected product behavior / acceptance

- Product-facing name/invocation Jarvis / “Hi Rokid, Jarvis”; same cloud Agent ID, gateway identifiers,
  storage keys, routes and thread mapping. Change AIUI definition, HUD title, metadata and current docs.
- Swipes scroll history only. No action on initial touch; commit a tap only after final classification.
  Voice commits only on Enter key-up; there is no speculative/pending GlobalHook tap or added timing
  delay. Double tap retains native Backspace back/exit. Existing post-recorder 650 ms send guard stays.
- Two-finger core control is forbidden absent a distinct stable physical event. System long-press AI
  shortcut is separate; no automatic Hi Rokid settings change or assumption that it reaches the page.
- Speaker labels ВЫ / JARVIS on their own lines, brighter/heavier/larger than old caption; compact
  spacing and a green separator between exchanges. Each message rendered once, bounded history intact.
- READY/LISTENING/TRANSCRIBING/THINKING/WORKING/DONE/ERROR: label + marker. Small opacity
  pulse using supported transition + a single 600 ms timer, active states only, stopped on static/hide. No large spinner.
- No backend/policy changes, no speech/text/credentials in trace. Test and package before private cloud
  upload/Repackage; download active AIX and verify exact source/config. Physical acceptance is separate.

## Official evidence (checked 2026-10-02)

- [AIUI page events](https://github.com/yodaos-project/AIUI/blob/main/documentation/1-framework/open-agent-format/page-events.en-US.md)
- [AIUI monochrome](https://github.com/yodaos-project/AIUI/blob/main/documentation/6-design/visual/monochrome.en-US.md): green #40ff5e, 100/60/40/8% hierarchy, stronger headings, outlines/spacing.
- [AIUI keyframes](https://github.com/yodaos-project/AIUI/blob/main/documentation/1-framework/wxss/at-rule.en-US.md)
- [Rokid AI shortcut](https://global.rokid.com/blogs/academy-glasses/3-4-other-ai-features): two-finger
  long press is configurable under Trackpad → Two-finger interaction → Long press. This does not prove
  a distinct two-finger event delivered to an AIUI page.

## Plan and verification

1. Apply the user-approved mapping; optional probe is not a prerequisite.
2. Implement deterministic key mapping, rename and visual/status changes.
3. Regression: touch→swipe never records, Backspace exits without voice, confirmed tap once, repeats/hide ignored,
   timer cleanup; history/identity/TTS unchanged; no duplicated content; motion stops outside active states.
4. Relevant AIUI tests/check, packaged runtime tests, private-config/backend checksum guards,
   secret scan, commit/push ALE-461, private deployment/readback → Needs Test.

Implementation target: Jarvis 0.4.0. No new gesture-classification timer, model/effort change or latency
speedup claim. The earlier diagnostic deployment is historical preparation, not the product release.

Motion compatibility: the general @keyframes guide conflicts with the official aiui-dev WXSS reference,
which explicitly marks animation-* unsupported and confirms opacity/transition. Use only the latter
safe subset, with a lightweight timer stopped on READY/DONE/ERROR/hide/unload; do not ship CSS animation.

Validation evidence is recorded in Linear with commit and cloud readback; physical final UX remains Needs Test.


## Startup regression — 2026-10-02

Physical 1.0.17 / 691bd5c opens Jarvis but stays at «Подключаюсь» (FAIL). Before modifying code:
local health and public authenticated health passed; unauthenticated/wrong-token requests returned 401.
Live cloud metadata/checksum matched the retained active 1.0.17 artifact; endpoint/token matched physical
1.0.13 and local configuration in memory. Backend source/process and tunnel were unchanged.
After the wearer confirmed reopening, tunnel total requests remained 334 → 334, errors 0. No request
reached this tunnel during that window; this is not a native exception trace or proof that the device
never attempted DNS/TLS. Gateway has no per-path access log.

Fault injection reproduces a new pre-request failure: 1.0.17 constructs StatusPulse outside the onLoad
try block and starts it in onShow before client.open. Missing interval globals or failing timer/render
callbacks can abort startup; 1.0.13 opens under the same timer faults. Exact native cause remains unproven.

Bounded repair 0.4.1: restore onShow's direct connection path, initialize motion lazily after essential
state rendering, isolate all optional status updates, and use the existing setTimeout/clearTimeout
capability instead of a new interval dependency. A failed pulse falls back to a static marker; teardown
cannot prevent recorder/TTS/client cleanup. No transport, gateway, thread or gesture changes.
Regression tests cover missing interval globals, failed pulse initialization/status bridge, timer and
async render failures, stale callbacks, health → READY, a voice turn/TTS and same-identity/history reopen.
Physical READY and the full Jarvis UX acceptance remain separate from tests/package/readback.
