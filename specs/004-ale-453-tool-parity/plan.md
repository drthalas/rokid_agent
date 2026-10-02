# Implementation Plan: ALE-453 native permission parity revision

Branch `main`; feature directory unchanged. Date2026-10-02. [Spec](spec.md).

## Summary
Remove the earlier Jarvis-created policy layer. Run the selected native workspace-write/on-request/
auto_review profile; inherit app/MCP/plugin policy and thread network/filesystem configuration. Keep
human RPC handling and add bounded auto-review/pending evidence, without changing the accepted frontend.

## Technical context
Node22 ESM/ws, Codex0.157.1 installed schemas, same macOS gateway/state and RV101 AIX1.0.19. No new
provider SDK/dependency/OAuth client. Production baseline08ab1a4; Git4e8d784. Native normal config
was read with zero overrides; current Desktop turn_context was inspected only for permission fields.

## Constitution check
Updated requirement explicitly selects native auto-review instead of the previous human-only overlay.
Loopback/auth/ownership/privacy/idempotency remain binding. Reviewer decisions are never manufactured
by gateway. Broad permission grants and voice approvals remain forbidden. Full Access is rejected.
Documentation must distinguish native auto-review denial from actual human RPCs and surface limitations.

## Design
- `src/codex.mjs`: spawn selected native profile; remove tool policy tables and no longer force per-app
  reviewer; inventory/disabled-state checks remain read-only. No credentials serialized in overrides.
- `src/protocol.mjs`: workspace-write/on-request/auto_review thread policy; turns inherit resolved thread
  sandbox rather than overriding with readOnly/network false. The normal native default network is false.
- `src/engine.mjs`: normal create/resume/turn ownership intact; distinguish review notifications from
  human requests. Human pending is immediate and stays pending by default; optional explicit timeout
  remains for deployments/tests that intentionally configured one. Cancel/disconnect/resolution clear handles.
- `src/tool-evidence.mjs`, `src/server.mjs`, `scripts/ctl.mjs`: local-only bounded review metadata and
  pending timing; no rationale/commands/tool arguments/auth data in evidence.
- `src/approvals.mjs`: retain fail-closed unsupported auth/input handling and per-request native responses.
- Tests: native config inheritance, actual workspace/outside-root writes, auto-review events, no app/MCP
  clamps, remaining human pending/decline, disabled state/dynamic restart, existing frontend pending hint.
- Reuse existing Spec Kit artifacts and scripts; replace their superseded human-only assumptions explicitly.

## Verification and delivery
1. Normal Desktop/config/native thread evidence before changes (completed inventory).
2. Isolated normal Browser/Computer and auto-review probes; no real destructive test path.
3. Tests first, minimal code change, regressions and native smoke before production restart.
4. Idle production restart with existing state/thread/tunnel/private config hashes and rollback source.
5. Actual A–K operations through that production instance; native risky/human behavior accurately labelled.
6. Commit/push with secret scan; Needs Test until wearer acceptance. Unsupported APIs/permissions remain
   documented limitations, never “fixed” by Full Access or synthetic approval.

Potential parallel work: read-only schema/auto-review research; root owns code, state and deployment.
