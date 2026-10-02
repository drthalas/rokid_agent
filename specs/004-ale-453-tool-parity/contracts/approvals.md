# Approval and transport contract

Public `/v1/*` unchanged. No tool-call proxy or approve endpoint is exposed to glasses.
Authenticated `/admin/approvals` remains loopback-only; local POST decision accepts `accept|decline`
for one opaque pending handle. Never accept decision/input through voice or task payload.

Native command/file request: `{decision:accept|decline}` only; no acceptForSession/rule amendment.
Native permissions request: empty granted permissions, scope turn (deny expansion).
Native `mcpServer/elicitation/request`: supported empty form waits for owner;
accept → `{action:accept,content:{}}`; decline/expiry → `{action:decline,content:null}`.
Unsupported modes/shapes are declined; unrelated native request methods return a safe RPC error.
Turn mismatch/terminal/disconnect must invalidate approvals; one decision cannot authorize a future call.

Optional local-only capability event inspection returns bounded safe metadata, never raw tool arguments/results.
No generic JSON-RPC or direct mcpServer/tool/call endpoint is added.

Native confirmation additionally requires `_meta.codex_approval_kind = mcp_tool_call`; arbitrary empty input forms are not approved. This marker was observed in the real native write probe.
