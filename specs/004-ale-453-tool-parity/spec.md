# Feature Specification: Codex Tool Parity

**Feature Branch**: `main` (no feature branch requested)
**Created**: 2026-10-02
**Status**: Specified; capability research in progress
**Input**: [ALE-453](https://linear.app/drthalas/issue/ALE-453). Jarvis must inherit the owner's normal Codex tools, existing connections and skills with explicit approval of external writes.

## User Scenarios & Testing

### User Story 1 — Reuse existing connected capabilities (Priority: P1)

The owner asks Jarvis to read recent mail, find a Drive document or inspect a GitHub repository using connections already available on the Mac.

**Why this priority**: A separate provider implementation would diverge from the owner's Codex environment.
**Independent Test**: Actual reads through the production gateway return results in the current Jarvis conversation with recorded tool identity/completion, without logging personal content.

**Acceptance Scenarios**:
1. Given an existing enabled Gmail connection, when the owner requests recent mail, a real Gmail tool executes and its result reaches HUD in the same conversation.
2. Given existing Drive/GitHub connections, equivalent safe reads execute real tools; generated prose without a tool call is not success.
3. Given an enabled MCP server and a discovered skill, at least one real MCP invocation and one skill workflow succeed, with evidence distinct from installation/catalog visibility.
4. Given a capability unavailable on the app-server surface, the inventory labels it unavailable/unknown and identifies the actual boundary without creating a provider-specific client.

### User Story 2 — Keep external actions under owner control (Priority: P1)

The owner requests a reversible mail draft; execution waits for a separate local approval and never interprets the voice request as that approval.

**Why this priority**: Enabling tools must not silently expand the agent's authority.
**Independent Test**: A safe draft request waits; declining/expiry/disconnect does not create it; separate explicit approval authorizes exactly that request and a draft is verified. Sending a real email is excluded without new authorization.

**Acceptance Scenarios**:
1. An external write surfaces pending approval on Jarvis while details and the decision remain local to the Mac.
2. A voice instruction to approve, an expired approval, an unknown request or a stale decision cannot authorize a write.
3. Existing user-disabled capabilities remain disabled; user policies that skip approvals cannot override this feature's explicit no-silent-write requirement.
4. Provider secrets, auth challenges and tokens are never serialized into device snapshots or diagnostic evidence.

### User Story 3 — Follow configuration changes without service code (Priority: P2)

The owner enables/disables a supported capability in normal Codex; after gateway restart/reload Jarvis reflects that state.

**Why this priority**: Integration availability belongs to Codex, not a second Jarvis catalog.
**Independent Test**: Disable/re-enable one selected capability in an isolated validation configuration, restart, and observe absence/presence without source changes. Production user configuration is preserved.

**Acceptance Scenarios**:
1. No provider-name allowlist or separate credential copy is required for a newly supported capability.
2. Disabled capabilities stay disabled after restart and previous conversation identity/history survives.
3. Existing Jarvis invocation, gestures, HUD, STT and TTS remain unchanged.

### Edge Cases

- Installed or authenticated does not imply callable; a callable catalog does not prove successful execution.
- A standalone MCP can require a different login than the equivalent connected app.
- Some Desktop plugins require host callbacks unavailable in a standalone app-server.
- Unknown/credential-bearing approval forms and URL authentication require local handling or fail closed.
- A disconnection during approval or execution leaves the result uncertain; never silently replay a write.
- Hook trust and hook side effects belong to the native environment; inventory hooks first, do not newly trust them.
- Tunnel availability can block hardware acceptance; diagnose separately rather than change Jarvis UX or gateway contracts to mask it.

## Requirements

### Functional Requirements

- **FR-001**: Inventory CLI version, effective user/project/managed configuration, configured/enabled/runtime MCP state, installed/enabled plugins, connected apps, skills, hooks and surface limits before production changes.
- **FR-002**: Classify each capability class as available, unavailable, or unknown on the actual app-server; keep discovery, invocation and physical evidence separate.
- **FR-003**: Inherit enabled native capabilities dynamically, preserving user-disabled settings and existing account connections; do not implement service-specific clients or OAuth sessions.
- **FR-004**: Preserve read-only filesystem and shell-network restrictions while permitting only the host tool paths needed for supported integrations.
- **FR-005**: Keep app-server/admin interfaces loopback-only, authenticated device transport, project allowlist and existing session/thread/idempotency/recovery behavior.
- **FR-006**: External writes/destructive operations require a separate, specific, expiring local decision; never auto-approve or grant session-wide authority from a voice prompt.
- **FR-007**: Preserve pending approval state until resolution/expiry, including safe denial of unsupported native request variants.
- **FR-008**: Do not send credentials/auth forms to glasses or retain them in public evidence, snapshots or logs.
- **FR-009**: Preserve accepted Jarvis cloud 1.0.19 UX/history/STT/TTS and Camera permissions.
- **FR-010**: Validate dynamic disable/re-enable across restart without permanent edits to the owner's normal configuration.
- **FR-011**: Physical acceptance must use the production gateway/app-server, proving real Gmail, Drive, GitHub, MCP and skill use plus a reversible write with local approval.

### Key Entities

- Capability inventory: capability identity/class, config enabled state, runtime availability and evidence boundary; no credentials/tool results.
- Pending local approval: specific native request associated with current conversation/turn, expiry, allowed decision and completion; device receives only pending status.
- Invocation evidence: tool/skill identity and terminal result correlated to session/thread/turn; no arguments, personal results or credentials.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All six acceptance categories (Gmail, Drive, GitHub, MCP, skill, approved draft) have real execution evidence through the production environment; hardware observations are recorded separately.
- **SC-002**: Negative tests demonstrate zero writes from voice-only approval, stale/expired/unknown requests or denied decisions.
- **SC-003**: Disable/re-enable validation changes the effective capability set with zero provider-specific source edits.
- **SC-004**: Gateway regression suite and accepted Jarvis interaction remain valid; session/thread continuity is verified across tool turns and restart.
- **SC-005**: Secret scans and snapshot tests reveal no provider credentials; network listeners remain within existing boundaries.

## Assumptions

- One owner uses existing authenticated Codex on this Mac; unavailable or unauthenticated native capabilities are reported rather than provisioned silently.
- Safe reads and creation of a test draft are authorized; a separate local approval is still required before the draft action executes. Real mail sending is not authorized.
- No Jarvis UX/history redesign, multi-chat feature, account binding changes or Cloudflare reliability project is in scope.
- The physical tests require the wearer; inability to perform them is reported as not run/blocked, not a fabricated PASS or implementation failure.
