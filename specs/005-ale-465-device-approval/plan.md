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
Post-design gate: verified native class/scope matrix and per-operation Computer Use lifetime evidence are in research.md. The initial Calculator-only prototype is superseded by this physical-failure revision.

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

## Revision plan — 2026-10-03

1. Inventory installed schemas/real native shapes and record scope matrix; no app-name allowlist.
2. Reproduce canonical failed/interrupted result loss before edits. Add exchange outcome/approval reason
   fields; merge same-turn authoritative native content with durable gateway outcomes on recovery.
3. Generic descriptor `{id,kind,title,action,target,risk,scope,expiresAt}` from verified structured input;
   retain correlation/context for patch items, never expose raw native params or automatic accepts.
4. Show immediate STOPPING/denial reason without releasing busy lock, then truthful canonical terminal
   result. HUD renders result presence, not success-only flag; TTS current outcomes once, restore silent.
5. Preserve existing physical card controls/default decline/second confirmation and deadline.
6. Relevant tests, real ephemeral Calculator/screenshot/draft attachment proof, secret scan, push, matching
   gateway/private cloud update and ACTIVE readback. Needs Test until physical acceptance.

Scope gate: allow only representable classes with proven native response/scope. Permissions requests
are turn-scoped by native contract and must disclose that lifetime; no session grant. Unknown command
code, uncorrelated patch, sensitive grants/auth forms fail closed visibly. Purely generic “allow command”
without material action/target information is not sufficient. No new dependency/second provider clients.

### Evidence-driven same-turn image handoff (required by main acceptance)

A real same-turn probe reached50 and an emitted native screenshot, then failed to transfer bytes from
CUA REPL to separate Node REPL. Native Code Mode inventory confirmed nested Gmail but no nested CUA;
independent draft attachment from a local generated JPEG passed. No shared-variable/private RPC bypass.

Add a bounded adapter for already-emitted successful native Computer Use JPEG/PNG image blocks only:
private temporary files (directory0700/file0600), max8MiB each,2 per turn/8 total,10min TTL and deletion
on terminal/disconnect/shutdown (healthy process; crash/filesystem-failure residues may need local cleanup). No extra capture, RV101 camera, recording/archive or provider client.
Supply generated artifact metadata as explicitly marked untrusted tool-data text using public native turn/steer with exact
expectedTurnId; it is data, never approval/new task. Canonical gateway history retains original voice
text and excludes this internal context. Native agent reads bytes using normal tools and calls existing
Gmail MIME API under unchanged policy. Test actual image hash→draft readback in the SAME ephemeral turn.

The installed public turn/steer schema omits experimental additionalContext. Use public input with a
fixed data-only marker, exact expectedTurnId and no approval authority; do not enable experimental API
in production merely for metadata. Canonical voice history retains the gateway-owned original prompt.
