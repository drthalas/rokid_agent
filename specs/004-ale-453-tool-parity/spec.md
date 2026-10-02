# Feature Specification: Codex Capability and Permission Parity

**Feature Branch**: `main` | **Created**: 2026-10-02 | **Revised**: 2026-10-02
**Status**: Revised requirements; implementation in progress
**Input**: [ALE-453](https://linear.app/drthalas/issue/ALE-453), owner revision: match normal Codex App **Approve for me**, not Limited or Full access.

## User Scenarios & Testing

### US1 — Use normal Codex capabilities from Jarvis (P1)
The owner reads Gmail/Drive/Calendar/GitHub/Linear, invokes an existing MCP and uses a discovered skill
in the existing glasses conversation, with native connections and enablement settings.
**Independent test**: real completed tool/skill calls through the production gateway, same session/thread.
**Acceptance**: user-disabled capabilities remain disabled; newly configured supported capabilities appear
after restart without provider-specific code. No credential copy or second OAuth session.

### US2 — Normal safe work and native escalation (P1)
The owner creates a workspace file, a Desktop test file and a Gmail draft without Jarvis imposing
extra manual confirmations. Native policy decides whether an action runs, is auto-reviewed, or needs a person.
**Independent test**: workspace write succeeds; outside-root Hello World write follows observed normal
Codex behavior without adding Desktop to writable roots; draft-to-self follows native app policy, never sends.
**Acceptance**: target profile is workspace-write/on-request/auto_review. Full Access and never are excluded.
No read-only/user reviewer override, app reviewer clamp, or blanket MCP prompt remains.

### US3 — See genuine human review promptly (P1)
When native Codex requires a human, Jarvis immediately exposes pending status and keeps that request
pending until a decision/native resolution/cancel/disconnect (unless an explicit timeout was configured).
**Independent test**: measure request-to-snapshot pending delay; existing HUD renders its pending hint.
**Acceptance**: voice task text is not a human approval; no fabricated auth/input answers or gateway-generated
accept on an auto-review notification. Per-call approval handles remain correlated and one-use. Dangerous
probe has no destructive execution path and is declined/cancelled; evidence distinguishes native vs mock.

### US4 — Separate Browser/Computer surfaces (P2)
The owner can use supported Browser/Computer capabilities independently of filesystem sandbox mode.
**Independent test**: public-page title and non-destructive desktop interaction via actual app-server tools,
or exact recorded missing host/tool/permission boundary. Shell/curl/web search is not Browser Use proof.
**Acceptance**: no danger-full-access workaround, account reset, cookie export, new trust or fabricated UI grant.

### Edge cases
- Disk config can differ from Desktop's per-chat managed permission profile and auxiliary writable roots.
- Installed, enabled, connected, invoked and physically accepted are separate states.
- Native auto-review denial may return a model-visible denial rather than a new human approval RPC.
- Computer Use app grants can remain user-facing despite auto-review; standalone host integration can fail.
- Auth/input/URL/device-verification forms that this integration cannot safely answer are not fabricated.
- A provider failure or tunnel interruption must not cause blind replay of an external write.

## Requirements

- **FR-001**: Prove normal effective config AND current Desktop session policy before production changes; inventory writable roots/network/apps/MCP/plugins/Browser/Computer without secrets.
- **FR-002**: Use workspace-write/on-request/auto_review as the selected native profile, respecting managed constraints. Do not use danger-full-access or never.
- **FR-003**: Inherit native app/MCP/plugin approval modes/reviewers and disabled state; remove Jarvis approval overlays and provider-name allowlists.
- **FR-004**: Inherit thread filesystem/network policy; do not broaden shell network or add Desktop merely to make a test pass. Distinguish host/MCP/app/browser network.
- **FR-005**: Eligible escalations go to native auto-review. Jarvis does not preemptively turn safe operations into local human requests.
- **FR-006**: Real human requests immediately set pendingApproval; no silent default 120-second wait followed by a Jarvis-created denial.
- **FR-007**: Never auto-accept a native human request, treat voice as approval, fake auth/input, or grant broad/session authority from a local accept.
- **FR-008**: Preserve loopback-only app-server/admin, authenticated gateway, allowlisted cwd, ownership, idempotency/recovery, secret filtering, history/STT/TTS and accepted Jarvis UX/AIX1.0.19.
- **FR-009**: Record bounded review/tool status metadata only; never raw credentials, browser auth, prompts/results or reviewer rationale in public diagnostics.
- **FR-010**: Prove native configuration refresh across restart without source edits or permanent edits to user configuration.
- **FR-011**: Run the acceptance matrix below; physical acceptance remains separate and required for Done.

## Success Criteria

| Gate | Expected observation |
|---|---|
| A Gmail read | Real connected-app read, same thread, physical HUD/TTS |
| B workspace write | New test file created automatically in selected project |
| C Desktop write | jarvis-test.txt / Hello World, native safe elevation; no Desktop root workaround |
| D Gmail draft | One draft-to-self, subject Jarvis Test, body Hello from Jarvis; never send; native decision respected |
| E Drive read | Successful native read/search; no data in diagnostic logs |
| F GitHub read | Real configured GitHub capability |
| G Linear read | Existing issue read, no mutation |
| H MCP | Existing enabled MCP actually invoked under native policy |
| I Skill | Discovered skill read/applied; execution evidence beyond a catalog |
| J Browser | Native app-server safe smoke PASS or exact surface/permission limitation |
| K Computer | Native app-server safe smoke PASS or exact surface/permission limitation |
| L risky request | Human request/denial/cancel where native policy requires it; no real destructive execution |

Additional measurable outcomes: backend request-to-pending status measured; no approval generated by
Jarvis for routine auto-reviewed actions; disabled/re-enabled capability changes after restart; zero
provider credentials in snapshots; regression tests and secret scan pass.

## Assumptions

- User explicitly selected Approve for me. This revision supersedes the previous all-writes-human and
  opaque-MCP-always-prompt requirements; native auto-review is not blanket approval.
- Workspace and Desktop Hello World files and the specified draft-to-self are authorized tests. Refuse
  to overwrite unrelated existing files. Sending mail, destructive execution and Full Access are not authorized.
- Native Desktop per-chat auxiliary roots are recorded as surface differences, not copied indiscriminately
  into Jarvis. Existing normal user/managed configuration remains authoritative for capabilities.
- No Jarvis UX redesign, multi-chat work, or Cloudflare reliability project unless transport blocks testing.
