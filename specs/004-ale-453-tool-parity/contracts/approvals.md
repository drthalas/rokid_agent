# Native approval contract

Native auto-review notifications are observations, never approval requests to answer. Eligible safe
operations execute under native policy; gateway does not manufacture local approvals or native accepts.
Remaining human RPCs immediately set pendingApproval. Existing authenticated loopback accept/decline
resolves one matching live request, never an entire session. Voice prompt is not this decision.

Supported command/file requests and native mcp_tool_call empty-form confirmations retain their specific
response types. Unknown auth/input/URL/device-proof shapes are not fabricated. Permission grants remain
bounded to supported requested subsets; unsupported expansion is reported rather than silently broadening.

Default human wait follows native lifecycle, without a gateway-invented120s denial. Explicit configured
timeout is optional. Disconnection/terminal/resolved events invalidate handles. Reviewer denied/timedOut
notifications do not automatically become a human RPC; this native surface distinction must be reported.

Public `/v1` and Jarvis runtime unchanged. Local-only review metadata supports timing/acceptance evidence.

Native permissions requests with literal absolute path read/write lists/entries or an explicit network boolean may remain pending. Local acceptance returns only that validated requested subset, scope turn; glob/special-root/unknown shapes are never fabricated or broadened. Native auto-review normally resolves eligible escalation before such a human request reaches gateway.
