# ALE-453 research — native permission revision

Owner explicitly superseded the earlier read-only/user and blanket MCP prompt requirements on2026-10-02.
Historical implementation/evidence remains in Git4e8d784 and validation.md; this document describes the
current decision. Existing feature directory is retained.

## Normal profile evidence before production changes

- ~/.codex/config.toml: workspace-write / on-request / guardian_subagent (legacy reviewer alias).
- Zero-override native config/read: workspace-write / on-request / auto_review; no managed requirements;
  apps/browser_use/computer_use tables null; no explicit user MCP approval modes.
- Ephemeral thread/start without overrides returns workspaceWrite, additional writableRoots=[], networkAccess=false,
  both temp exclusions false; project cwd is implicitly writable. Desktop is not a writable root.
- Actual current Desktop turn_context confirms on-request/auto_review and a managed restricted filesystem
  profile. It adds a per-chat visualization root, temp roots and protected metadata subpaths. This is
  session/UI state, not an enterprise requirements file or a global permission setting.
- Normal Desktop execution created a new workspace file and, with native elevated tool review, a new
  Desktop Hello World file. No existing file overwritten; no Desktop root added.

[Sanitized inventory](permission-inventory.json). User config was not modified or copied wholesale.

## Decision

Select workspace-write/on-request/auto_review at native launch/thread/turn boundaries, matching the
observed normal profile. Remove ALL Jarvis apps/MCP/plugin approval table overrides. Preserve disabled
state verification, native credential ownership and the existing environment allowlist. Turns inherit
resolved thread sandbox/root/network configuration; host/app/MCP/browser networking is independent.
Full Access and never are excluded. Native APIs may refuse a profile prohibited by managed requirements.

## Review flow

Native item/autoApprovalReview started/completed notifications are evidence, not requests to accept.
Record bounded action-type/status/risk/IDs/timestamps only; never rationale/command/input/provider data.
Real remaining command/file/native empty-form confirmations still go to the loopback-only owner flow.
Pending is immediate; no default120s expiry. Optional explicit timeout remains supported. Lifecycle
resolution/cancel/disconnect invalidates the handle. Voice text cannot resolve it.

Auto-review denial does not necessarily produce a new human RPC. The installed ClientRequest schema
has no public equivalent of the TUI /approve denied-action retry marker; do not fake that marker using
prompt text. Unsupported auth/input/device-proof forms remain fail-closed and are reported as a limit.

## Browser and Computer

Core app-server schemas have no direct browser/computer action methods; availability depends on host
integration. Runtime tests proved native Chrome via cua_repl opened example.com and returned Example
Domain. Calculator Computer Use was initially refused because app access had not been granted; after
an explicit owner decision on the native empty confirmation, controls were returned without input.
These are actual app-server MCP invocations, not shell/web-search substitutes. A separate built-in IAB probe failed with the exact native error “Browser is not available: iab”. No Chrome fallback was used in that probe.

Official docs describe built-in Browser as Desktop-only and Computer Use app grants as direct human
prompts even with auto-review. The installed Desktop-backed MCP bridge may expose additional surfaces;
its observed behavior, not installation metadata, determines the local result.

## Safe probes / limits

Native harmless MCP write probe: auto-review approved, counter incremented once, no gateway human
request/accept. Dynamic existing node_repl disable/re-enable across isolated restarts passed; normal
user config unchanged. Synthetic human/unsafe requests validate pending/decline plumbing without an
executable destructive action. They do not prove that stock auto-review denies every possible risky action.
Production file/draft and read matrix must be verified after deployment; physical acceptance is separate.

Sources: [auto-review](https://learn.chatgpt.com/docs/sandboxing/auto-review),
[permission modes](https://learn.chatgpt.com/docs/permission-modes),
[app-server](https://learn.chatgpt.com/docs/app-server), installed0.157.1 schemas and actual native probes.
