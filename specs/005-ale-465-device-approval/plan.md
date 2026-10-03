# Implementation Plan: ALE-465 device approval

**Branch**: `main` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

## Summary
Retain native policy and existing history/protocol. Add a current one-use sanitized approval projection,
a narrowly authenticated decision route and a default-decline AIUI card. Unknown shapes immediately
decline; server-side30s expiry plus bounded native completion prevents opaque indefinite Working.

## Technical Context
Node22 ESM/ws; macOS gateway and Ink/JavaScript RV101 frontend; no new dependency. Existing private
state JSON stores only outcome reason, never raw approval params. Approval handles remain memory-only.
Tests: node:test integration/mock app-server, native harmless probe, AIUI page/controls and AIX packaging.
Single owner/shared device token. Poll1s; deadline30s; no profile, tunnel, VPN or credential changes.

## Constitution Check
Owner explicitly authorizes device decisions, superseding old local-only restriction in principleII.
Amend that rule narrowly: a reviewed physical card can resolve a safe per-action request via device API;
admin remains loopback and voice cannot approve. Native auto_review remains untouched. No grants whose
scope cannot be proven, arbitrary command display or fabricated auth forms. Preserve all other principles.
Post-design gate PASS: isolated native exact Calculator read re-prompts on the next read (with and without reset) and in fresh threads. Only that observed shape is enabled; see research.md.

## Project Structure
- src/approvals.mjs: deterministic descriptor constructor with fixed labels, strict shape/scope validation.
- src/engine.mjs: same-turn pending descriptor, expiry, native response, high-risk challenge, outcome.
- src/server.mjs: device decision route; strict body and decision validation, existing bearer boundary.
- aiui-agent/lib/gateway.js: validate descriptor, APPROVAL state, non-replayed decision delivery.
- aiui-agent/lib/voice-ui.js and pages/index/index.ink: default decline, high-risk second screen,
  arrow navigation, classified/delayed Enter, back decline, one generic TTS announcement.
- test/approval-device.test.mjs and AIUI tests: contract, lifecycle, scope and UX regressions.
- scripts/device-approval-smoke.mjs: isolated native safe request/decline/automatic review proof.

## Research and Design
See research.md, data-model.md and contracts/approvals.md. Keep pendingApproval boolean for fallback
clients; add approval nullable descriptor. No arbitrary display strings trusted from native metadata.
Unsupported native request kinds return native decline or explicit unsupported RPC error as applicable.
Decline gives Codex10s to finish safely, then interrupts. If interrupt does not conclude, show truthful
terminal uncertain error and require reconciliation; do not claim unknown work stopped.

## Delivery
Tests first; implement sequentially; review all diffs/secrets and run relevant native smoke. Commit/push
main per explicit request. Restart idle gateway preserving mappings/config, deploy private AIX, read back
ACTIVE cloud runtime/config, then Needs Test. Main physical task requires wearer acceptance separately.

## Complexity Tracking
Only justified boundary expansion: explicit device human-decision route replaces local-only review for
proven bounded cases. A generic MCP proxy/approval allowlist by provider name alone is rejected.
