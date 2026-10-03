# Implementation Plan: ALE-471 screenshots
**Branch**: `main` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)
SESSION: NEW SESSION. MODEL: gpt-6-astra / EFFORT: high (native turn_context; requested Medium). WHY: capture routing and private attachment handoff.

## Summary
Keep native CUA and existing Gmail connector. Make app-result vs full-desktop routing explicit in gateway instructions. Keep the newest bounded CUA artifacts. Add a shell-invoked desktop capture helper, executed under ordinary native sandbox/auto-review; do not make the gateway itself capture or add provider APIs. Validate captured images, return private metadata, clean on handoff or ten-minute independent lease expiry. Verify both flows through isolated real Engine/Codex turns.

## Technical Context
Node >=22, existing built-ins and ws; macOS screencapture and sips, existing CUA/Gmail. No package/lockfile change. Private system-temp storage only. Node tests and real native-tool turns. Fifteen-second capture timeout; ten-minute maximum temporary lease; 8 MiB per image. One owner, all active displays.

## Constitution Check
PASS before and after design: existing project/thread ownership preserved; no policy/approval changes; helper runs through native exec approval; no secrets/images in tracked evidence. Existing native image export remains non-capturing. Owner explicitly authorizes desktop capture and unsent self drafts. No public API/device endpoint or Gmail client. Physical release acceptance deferred.

## Project Structure
- `src/image-artifacts.mjs`: bounded newest native result retention and source metadata.
- `src/screenshot-instructions.mjs`, `src/engine.mjs`: explicit routing, attachment and terminal error guidance.
- `src/desktop-capture.mjs`, `scripts/desktop-capture.mjs`: private capture, validation, cleanup lease.
- `test/image-artifacts.test.mjs`, `test/desktop-capture.test.mjs`, `test/screenshot-instructions.test.mjs`: targeted regressions.
- `scripts/screenshot-smoke.mjs`: real isolated Engine/Codex acceptance, no synthetic approval or send.
- `ARCHITECTURE.md`, `RUNBOOK.md`, this feature's evidence: actual contract/limitations.
