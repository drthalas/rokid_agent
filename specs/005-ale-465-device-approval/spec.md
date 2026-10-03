# Feature Specification: Human approval on Jarvis

**Feature Branch**: `main`
**Created**: 2026-10-02
**Status**: Native exact-app persistent consent revision (2026-10-03)
**Input**: [ALE-465](https://linear.app/drthalas/issue/ALE-465), owner request and comments.

## User Scenarios & Testing

### US1 — Review a concrete action on glasses (P1)
The wearer sees a dedicated approval card when native Codex needs a person, then selects a scope-appropriate allowance
or decline without returning to the Mac. Why: an opaque Working screen prevents glasses-first use.
Independent test: a harmless native human request is represented, deliberately allowed, and resumes
one action in the same turn. A risky simulator additionally requires a second confirmation.
Acceptance: default DECLINE; arrow changes selection; tap confirms; back declines and exits. Speech,
a touch before the card, repeats, resolved/foreign/stale decisions never grant permission.

### US2 — Never wait indefinitely (P1)
The wearer gets an explicit cancellation when no decision arrives in 30 seconds, and an immediate
unsupported-action explanation for requests that cannot safely be represented. Why: loss of connectivity
or an unknown auth form must not leave the glasses waiting for invisible Mac input.
Independent test: timeout and unsupported form both decline; no action runs; the turn concludes or
is interrupted with truthful terminal status. Native continuation after decline may finish safely.

### US3 — Preserve normal tools and conversation (P1)
Native Approve-for-me safe actions continue automatically; genuine human requests alone show the card.
Independent test: safe native MCP action executes without a new wearer prompt; existing session/thread,
history, voice controls, TTS and reconnect remain intact. Main physical scenario: Calculator20+30,
screenshot and Gmail draft to self with attachment; never send mail.

### Edge Cases
- Native permission forms can grant wider/persistent rights than their display suggests; reject these.
- One action may request several permissions or unknown code; unsupported is safer than guessing.
- Lost decision ACK never silently resubmits accept; refresh authoritative state instead.
- Native resolution, disconnect, cancellation, expiry and new turn invalidate old handles.
- Shared owner bearer is not hardware attestation; a trusted configured device is part of the boundary.

## Requirements

### Functional Requirements
- FR-001: Voice text is never approval. Require a new deliberate physical action after a visible card.
- FR-002: Bind one decision to one approval/session/current turn/concrete action; never blanket grants.
- FR-003: Show only a deterministic, bounded, sanitized description; no raw commands, code, credentials,
  provider payloads, environment or unnecessary private paths.
- FR-004: Unsupported/complex auth/input/unknown/sensitive grants immediately fail closed. Persistent
  grants are forbidden except the verified native exact-app Computer Use consent in FR-018.
- FR-005: Default to DECLINE on both first and high-risk second screens. Back declines; double-tap
  classification must cancel a pending accept before delivery. Optional generic TTS occurs once per card.
- FR-006: Decline after30 seconds without choice. Show a clear timeout/unsupported/declined result,
  preserve same-turn native completion where possible and bounded cancellation otherwise.
- FR-007: Preserve workspace-write/on-request/auto_review, native tool policy, auth, TLS, loopback,
  allowlist, private configuration, Camera, history, thread continuity and idempotency.
- FR-008: Narrow authenticated device decisions only; never expose local admin credentials or API.
- FR-009: Tests include decline, timeout, back, unsupported forms, stale/repeat/foreign decisions,
  high-risk second confirmation and automatic native safe actions.
- FR-010: Deliver reviewed source and private active cloud AIX readback; physical proof stays separate.

### Key Entities
- Approval: current one-use capability with fixed action description, risk, expiry and owner/turn binding.
- Wearer choice: default-decline selection, optional second confirmation, pending delivery, no saved accept.
- Approval outcome: bounded reason associated with the current exchange, preserved across reopen.

## Success Criteria

- SC-001: On a healthy connection, a human request appears as an approval card on the next normal poll.
- SC-002: No response causes decline within30 seconds plus scheduling tolerance; unsupported forms do
  not wait for human input. Stalled native completion gets a bounded interruption attempt and clear result.
- SC-003: All negative cases execute zero protected actions; accepted one-use requests execute once.
- SC-004: Physical Calculator result50 and attached draft-to-self complete in one turn after wearer
  approval, with nothing sent; history/HUD/TTS remain correct.
- SC-005: No new prompts for native auto-reviewed safe actions; no private data in published source/logs.

## Assumptions

Single trusted owner/device credential; app-server remains the authority for tool policy. Representable
native shapes must be proven from installed schemas/real requests before enabling them. Unknown shapes
remain unsupported, even if this limits the main physical scenario. ALE-462/463/464, tunnel and VPN are
out of scope. Existing stuck production approval is declined/reconciled before implementation.

## Revision: generic native classes and truthful terminal outcomes

Owner physical evidence: Calculator card/swipe/tap PASS; interaction20+30 and screenshot/draft workflow
FAIL; unsupported denial was not visible until a follow-up question. The Calculator-only prototype is
not general approval support. This revision supersedes any implementation-specific app allowlist.

- FR-011: Route by verified native request class/schema, not app/provider product names. Inventory
  command, patch, permissions, MCP and Computer Use request/response/scope and display completeness.
- FR-012: Describe action, target, risk and actual scope. Never label a turn-wide native grant “once”;
  blanket session grants remain forbidden; native exact-app persistence is the FR-018 exception. Unknown/opaque shapes fail closed rather than hiding risk.
- FR-013: Unsupported request immediately shows its safe reason while native continuation is still busy.
- FR-014: Every declined/unsupported/timeout exchange retains readable canonical assistant text and
  a separate truthful outcome even for interrupted/failed/uncertain completion. Recovery and next turn
  must not erase it. Empty completed native answers get an explicit no-answer result, never silent Done.
- FR-015: Current terminal outcome appears in HUD and TTS once; historical restore is silent. Preserve
  successful completion separately from a renderable outcome; do not turn cancellation into success.
- FR-016: Real ephemeral diagnostics cover Calculator interaction, screenshot access/capture and Gmail
  draft attachment. No send, no production thread test, no fake equivalence inferred from tool names.

Additional tests: empty native completed/failed/interrupted, commentary-only completion, notice plus
useful final text, restart/hydration, uncertain interruption, multi-request/turn isolation, generic
app-target validation, scope display and unsupported auth/opaque code. Physical main scenario must
actually reach50 + screenshot + attached draft + HUD/TTS/history; build/mock is not acceptance.

- FR-017: The already-requested native screenshot must be transferable to the existing draft tool in
  the same turn. Any necessary temporary copy is private, bounded and automatically deleted; it never
  creates new capture/approval, changes the original voice history or becomes a public device endpoint.

## Revision: native persistent consent for one Computer Use app

- FR-018: For the proven cua_repl empty form app-consent request with connector_id=computer-use,
  canonical bundle ID and native persist options session/always, offer DECLINE and ALWAYS ALLOW only.
  App identity MUST come from native tool_params.app, never fuzzy display-name matching or client input.
- FR-019: Every persistent accept requires a second default-NO physical selection/tap with an opaque
  current-request challenge, including low-risk apps. Both screens disclose the exact app and future-task
  lifetime. Sensitive actions still follow native policy. Never expose an all-app or one-time alternative
  in this specific app-consent flow.
- FR-020: After matching second confirmation, transport {action:accept,content:{},_meta:{persist:always}}
  using the native request ID. Native provider owns saving/consuming/revoking trust; no gateway allowlist,
  consent-store writes, altered app policy, unconditional approval mode or synthetic approval.
- FR-021: Prove native store membership and a new user turn with Calculator20+30=50 plus CUA image,
  with zero repeated app-consent. App trust alone cannot suppress a separate native high-risk fixture.
  Failed/unknown persistent shapes still fail closed; ordinary nonpersistent decisions stay unchanged.

This owner-authorized exception replaces the earlier blanket persistent-grant prohibition. The pending
decision remains one-use/current-turn/30s; only the resulting native consent has future-task lifetime.
Physical first-use/second-confirmation acceptance and release/deploy remain separate gates.
