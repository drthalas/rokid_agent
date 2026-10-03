# ALE-465 approval scope research

## Decision
Do not enable Computer Use acceptance labelled allow-once until native grant lifetime is verified.
Persist request metadata offers scope choices; omission is not proof of one-action semantics. Fail closed
for unsupported/unproven shapes. No `persist:"once"` invention, string-matching Calculator in arbitrary
code, auth fabrication, or gateway autoaccept.

## Evidence
Installed Codex0.157.1 schema leaves MCP `_meta` arbitrary. Official [app-server documentation](https://learn.chatgpt.com/docs/app-server)
defines accept/decline/content, but does not establish Computer Use grant lifetime. Native permission
requests can grant turn-wide filesystem/network rights; these cannot be relabelled one-action grants.

A fresh isolated ephemeral Calculator read probe was DECLINED. Actual request: mcpServer/elicitation/
request, empty form, server cua_repl, native mcp_tool_call, tool_name get_app_state, exact tool_params
app=com.apple.calculator, low risk. `persist` is a non-null array of two string scope options. No raw
provider message, metadata, credentials or user text copied into repository.

Installed ChatGPT.app app.asar source (read-only inspection):
- webview/assets/computer-use-app-approval-request-card-f4295eb3ed5a.js labels primary choice
  “Allow this conversation”; accepts using response metadata persist=session when offered, otherwise null.
  “Always allow” chooses persist=always.
- webview/assets/app-shared-59042e7300f7.js serializes accept with content={} and supplied `_meta`;
  omitted metadata becomes null. This establishes serialization, not host grant lifetime.
- .vite/build/bootstrap-yYZ8rgHq.js validates persistence choices session/always, optional string or array.
- Native SkyComputerUseClient symbols include sessionApprovedBundleIdentifiers and persistentApprovals.
  Its get_app_state documentation refers to starting an app-use session. Stripped implementation is not
  enough to infer omitted-persist behavior.

Read-only research was delegated per speckit-plan Phase0. Conclusions independently bounded: single-use
is **unverified**, not proven impossible. Native UI's normal conversation scope is incompatible with the
owner's strict no-session-grant requirement if represented as “Разрешить один раз”.

## Alternatives
- Copy existing admin accept to device: rejected; previous Calculator regex only proved target presence,
  not complete action or grant lifetime.
- Always/session permission: excluded by owner scope; requires a separate product/security decision.
- Omit persistence and assume once: rejected without host behavior proof.
- Isolated read-only test with explicit owner authorization for possible temporary-conversation grant:
  proposed. Capture first and repeated requests, immediately decline additional approvals, end ephemeral
  thread/process. No typing, screenshots, provider write, persistent choice or global config changes.
- Fail-fast unsupported path: safe fallback, but not proof of the requested physical Calculator workflow.

## Current gate
Owner authorized the isolated read-only diagnostic on2026-10-03, solely as a measurement exception.
A fresh ephemeral thread receives one exact Calculator get_app_state acceptance with no persist metadata;
a second read tests reuse, then process/thread termination and a new deny-only thread test cross-thread
isolation. No production grant or policy change is authorized by this diagnostic exception.
Other protocol/UI design is recorded in plan/data-model/contracts. Do not mark full design/implementation
or release complete until verified safe subset and its limitations are settled.

## Resolved native scope gate — 2026-10-03

Owner-authorized temporary diagnostic exception exercised two separate ephemeral conversations. In each,
first exact Calculator get_app_state accepted with `{action:accept,content:{}}`, no persistence metadata;
controls were returned. A second turn requested a fresh approval and was declined: once with a REPL reset
and independently without any reset. Both failed to read controls after decline. After unsubscribe and
process termination, fresh deny-only threads again required approval and could not read controls. No
click/typing/screenshot/provider action performed. All diagnostic threads unsubscribed, processes ended.
This proves one-request behavior for the observed exact0.157.1 get_app_state Calculator shape; it does
not establish one-shot semantics for arbitrary tools/grants. Enable only that proven shape, omit response
persist, reject unknown variants. Description is explicitly one Calculator window read, not blanket app
control. High-risk metadata (if presented on that otherwise identical bounded shape) requires two stages.
Other command/file/permissions/MCP forms remain unsupported because no complete safe display/scope parser
has been proved. Native auto_review operations are unaffected. Main physical workflow may encounter an
unsupported later tool request; report that boundary, never broaden grants silently.
