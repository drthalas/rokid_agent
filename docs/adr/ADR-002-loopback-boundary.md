# ADR-002: Gateway is the network boundary; Codex stays on loopback

Status: Accepted (existing implemented decision, 2026-10-01).

## Context

Voice clients need project-scoped continuity without exposing the account's app-server or automatically consenting to dangerous actions.

## Decision

Expose only the authenticated HTTPS device gateway. The gateway owns sessions, request idempotency, project routing and approval mediation; the owned persistent Codex app-server and separate admin listener bind to 127.0.0.1. Only local explicit approval can accept a supported command/file request. Cloudflare is a replaceable HTTPS transport, not a Codex/domain interface.

## Alternatives and consequences

Direct network app-server exposure lacks this boundary. Stateless exec per utterance would discard the selected lifecycle. Shared desktop active-thread control would create ownership races. A separate gateway adds persisted mapping/reconciliation work; cwd allowlist/read-only sandbox are not complete filesystem isolation. Import is limited to existing idle threads. Details and caveats: [architecture](../../ARCHITECTURE.md).
