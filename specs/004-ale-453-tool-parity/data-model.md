# Data model — native permission revision

- Selected permission profile: workspace-write/on-request/auto_review. Native config resolves additional
  roots/network/apps/MCP/plugin policies. Never serialize credentials into a second policy representation.
- PendingApproval: one local UUID→RPC id/method/params, session/turn, receivedAt, pendingAt and optional
  expiresAt. Default expiry is absent; native resolution/turn termination/disconnect or owner decision
  removes it. An explicit configured timeout is honoured. Device sees pendingApproval boolean only.
- Review evidence: last64 metadata records with thread/turn/review id, action type, review status, risk
  category and timestamps. No rationale, paths, commands, input, output, credentials or auth challenges.
- Tool evidence: existing bounded local-only completion identifiers; no public schema change.
- Session/history/idempotency: unchanged.
