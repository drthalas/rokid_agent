# ALE-461 — Jarvis physical UX polish

Canonical task: [ALE-461](https://linear.app/drthalas/issue/ALE-461).
Baseline: 75ac72c. Gateway/Codex, credentials, protocol/session identity, Camera and ALE-453 are out of scope.

## Physical evidence gate

User reports visible history/TTS, but a swipe's initial touch starts recording; labels are too weak.
Current interpreter invokes tap on GlobalHook down. Official AIUI defines GlobalHook as temple touch,
not a classified tap, and documents Enter/Backspace/ArrowUp/ArrowDown page events.
Before choosing a replacement interpreter, capture actual code/edge/timing sequences on this RV101:
single/double tap, one-finger up/down and forward/back swipes, two-finger tap/double/long press.
These are seven groups / nine individual directions/actions. Repeat each three times if possible.

ADB currently lists no device. Existing production trace filters out unrecognized codes and is only
in agent-local storage; it is not a complete physical inventory. Studio preview events are not physical
proof. Prepare a separate diagnostic project under tools (excluded from production AIX), without mic,
Codex requests, network calls or config. It shows/saves bounded sanitized raw codes and relative times.
Do not encode event codes into gateway latency fields or change the gateway to transport them.
Collect the displayed traces from the wearer before changing gesture interpretation.

## Expected product behavior / acceptance after measurement

- Product-facing name/invocation Jarvis / “Hi Rokid, Jarvis”; same cloud Agent ID, gateway identifiers,
  storage keys, routes and thread mapping. Change AIUI definition, HUD title, metadata and current docs.
- Swipes scroll history only. No action on initial touch; commit a tap only after final classification.
  A swipe/Backspace/hide cancels pending tap. Double tap retains native back/exit. Choose classification
  timeout and release mapping from trace; also verify delayed mic start is permitted by native runtime.
- Two-finger core control is forbidden absent a distinct stable physical event. System long-press AI
  shortcut is separate; no automatic Hi Rokid settings change or assumption that it reaches the page.
- Speaker labels ВЫ / JARVIS on their own lines, brighter/heavier/larger than old caption; compact
  spacing and a green separator between exchanges. Each message rendered once, bounded history intact.
- READY/LISTENING/TRANSCRIBING/THINKING/WORKING/DONE/ERROR: label + marker. Candidate: small opacity
  pulse via documented CSS @keyframes, active states only, removed on static/hide. No large spinner.
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

1. Instrumentation-only build + wearer trace (pending). No guessed event/timing fixture called physical.
2. Implement bounded gesture state machine, rename and visual/status changes using measured input.
3. Regression: touch→swipe never records, double cancels tap, stable tap once, repeats/hide cancel,
   timer cleanup; history/identity/TTS unchanged; no duplicated content; motion stops outside active states.
4. Relevant AIUI tests/check, packaged runtime tests, private-config/backend checksum guards,
   secret scan, commit/push ALE-461, private deployment/readback → Needs Test.

No physical traces received yet; no final gesture mapping or latency claim chosen.
