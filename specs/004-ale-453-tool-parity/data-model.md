# Data model

- Effective capability policy: native merged configuration + server identity/plugin ownership. Derived
  overrides contain approval leaves only; **never contain transport URLs, headers, environment values or credentials**.
  Explicit enabled/disabled and tool allow/deny lists remain owned by native configuration.
- PendingApproval: one local UUID → RPC id/method/params, session id, expected turn id, expiresAt/timer.
  **Only active matching thread/turn requests are eligible; each local UUID resolves at most once**.
  No persistence. pending → accepted/declined/expired/resolved/disconnected; all terminal paths remove it.
  Device projection is **pendingApproval boolean only**. Command/file semantics unchanged.
- MCP confirmation: **form with object schema, zero properties and no required fields**. A local accept
  returns empty content; URL, secret/free-text/unknown forms and device verification are unsupported.
- Tool evidence: bounded last 64 records; threadId/turnId/itemId, server/tool identity, started/completed
  status and timestamp. **No arguments, outputs, error detail, auth metadata or personal content**.
- Session/thread/history/idempotency entities: no migration or shape change.

Native confirmation additionally requires `_meta.codex_approval_kind = mcp_tool_call`; arbitrary empty input forms are not approved. This marker was observed in the real native write probe.
