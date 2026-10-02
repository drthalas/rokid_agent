# Implementation Plan: ALE-453 Codex Tool Parity

**Branch**: `main` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)
**Feature directory**: `specs/004-ale-453-tool-parity` (Spec Kit feature identity, not an actual Git branch).

## Summary

Inherit native enabled capabilities while replacing blanket MCP/apps/plugins/hooks isolation with a
scoped approval-policy overlay. Extend the existing local approval state machine for proven native
MCP confirmation forms. Preserve public snapshots and Jarvis sources. Gate production restart on
regression tests plus isolated real-app-server proof of safe reads and denied/approved write controls.

## Technical Context

- Language/version: Node.js 22 ESM, Codex CLI 0.157.1 JSON-RPC over loopback WebSocket.
- Dependencies: existing ws only; no provider SDK or credential library.
- Storage: existing gateway state/history unchanged; approvals and bounded tool evidence in memory.
- Testing: node:test unit/integration, real isolated app-server proof, then production and physical tests.
- Platform: macOS Mac mini; existing AIUI Jarvis on RV101 via private HTTPS.
- Performance: no extra inference per user turn; capability policy resolves at thread create/resume.
- Constraints: no user config writes, provider credentials/logs, UX/history changes or shell network expansion.
- Scope: single owner, current allowlisted projects; native capability surface only.

## Constitution Check

Pre-research and post-design: PASS. Persistent identities/idempotency preserved; readonly/shell-network
policy and loopback boundaries retained; approvals remain local/explicit; no secrets in snapshots;
visibility/invocation/physical evidence separated. Full Spec Kit used for the security-sensitive change.
Installed/trusted host hooks/MCP startup are not claimed sandboxed by tool approvals. No new dependencies.

## Project Structure

- `src/tool-policy.mjs`: pure credential-free approval override construction from effective config/native server metadata.
- `src/codex.mjs`: inherited spawn config, runtime inventory/policy instead of disable-all verification.
- `src/approvals.mjs`: narrow native confirmation validation/response; unsupported shapes deny.
- `src/engine.mjs`: scoped approval lifecycle and content-free tool completion evidence.
- `src/server.mjs`: local-only evidence inspection if needed; device routes unchanged.
- `test/tool-policy.test.mjs`, `test/approvals.test.mjs`, existing integration/protocol/helpers: policy and lifecycle coverage.
- `scripts/tool-parity-inventory.mjs`, `scripts/tool-parity-smoke.mjs`: sanitized native visibility and acceptance evidence.
- `ARCHITECTURE.md`, `RUNBOOK.md`, `docs/setup-status.md`: resulting boundaries/operations/evidence.
- `aiui-agent/`, private config, cloud AIX, tunnel: unchanged unless an independently proven blocking issue requires scoped action.

## Implementation phases

1. Complete inventory and record surface limits (done before runtime changes).
2. Test pure policy overlays: enabled inheritance, preserved disables, nested overrides, no credentials, safe key handling.
3. Test native elicitation support and expiry/stale/foreign/unknown denial before routing it.
4. Replace force-disable configuration with inherited capability policy; instrument only bounded metadata events on Mac.
5. Run mock regressions and real isolated model-turn proof. Readonly annotations/policies must be verified;
   do not promote a policy merely because config/read accepts it. Direct tool-call RPC is diagnostic only.
6. Restart existing production gateway with recorded rollback and preserved state/IDs; run read-only production
   acceptance, then physical wearer tests. Draft action stays pending until explicit local owner approval.
7. Document exact evidence/limitations and Linear Needs Test; Done only after physical acceptance.

No assumption that general MCP form input, URL OAuth or device-auth challenges can be answered by a
boolean approval. Current bounded implementation declines those shapes. A future expansion needs its
own schema-safe local input flow.

## Complexity Tracking

No constitution exceptions. Two small policy/approval modules isolate security decisions for testability;
no integration framework or service adapters. Research agent was used for read-only schema/policy analysis.
