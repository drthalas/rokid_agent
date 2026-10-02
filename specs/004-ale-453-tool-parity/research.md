# ALE-453 research and decisions

## Actual surface (2026-10-02)

CLI 0.157.1; generated installed-version experimental JSON schema inspected. Temporary stdio app-server
used the same environment allowlist as production, safety policy only, and an ephemeral thread.
Production remained on accepted 5e38d93 / cloud AIX 1.0.19. Sanitized [inventory](inventory.json).

| Class | Evidence | Classification |
|---|---|---|
| Effective config | config/read succeeded: user + system + diagnostic session flags; no project config or managed requirements | AVAILABLE |
| MCP | codex_apps connected, 552 tools; node_repl/cua_repl connected; user-disabled computer-use disabled | AVAILABLE; per-server limits |
| Standalone Vercel MCP | authenticationRequired, zero tools | NOT AVAILABLE with current login; no new OAuth attempted |
| Desktop-local helpers | codex_app/code-review disabled in diagnostic runtime | NOT AVAILABLE on this launch surface |
| Plugins | plugin/list reports installed/enabled local and remote marketplace entries | AVAILABLE for inventory; under-development API not a production dependency |
| Apps | app/installed returns 18 enabled/callable apps including Gmail/Drive/Calendar/GitHub/Linear | AVAILABLE catalog; execution evidence separate |
| Skills | loaded discovery returns 133 entries, 115 attributed to plugins, including 10 project Spec Kit skills | AVAILABLE |
| Hooks | hooks/list returns none, no errors/warnings | Discovery AVAILABLE; execution untested/not needed |

App-list metadata timed out on one diagnostic launch; app/installed/runtime listing succeeded. This is
not proof of full Desktop equivalence. UI/server-host dependencies may remain unavailable even though
packages are installed. Gmail get_profile completed through diagnostic mcpServer/tool/call; no profile
content was logged. This read bypassed turn approval callbacks, so it is NOT a safe production tool route.
Gateway must never expose direct arbitrary MCP tool calls to RV101.

## Approval contract

A real read-only model turn with native app `prompt` policy requested Gmail get_profile and emitted
`mcpServer/elicitation/request`, mode `form`, requestedSchema `{type:object,properties:{}}`. Diagnostic
client declined; native MCP tool completed failed. This proves a per-call confirmation path, not a write
acceptance. Normal `writes` mode and side-effect gating require their own tests before production enablement.

Decision: inherit configuration, overlay only local-human review and at-least-write approval policy;
retain a user's stricter `prompt` policy, never copy credentials or turn disabled tools on. Apply defaults
and existing per-tool/per-account overrides so `approve` or `auto_review` cannot bypass the owner.
Use effective configured identities plus native MCP plugin metadata, not provider names.

Decision: support the observed empty confirmation form through existing loopback local admin accept/decline.
Return `{action:accept,content:{}}` only for a separately approved supported form. Other MCP form inputs,
URL/device-verification challenges, generic requestUserInput and dynamic tool execution fail closed;
never fabricate OAuth proof or choose an arbitrary answer. Command/file per-call approval remains intact.
Match thread and any supplied turn; expiry, disconnect and terminal events invalidate handles. Device
snapshot keeps only pendingApproval; raw elicitation payload never reaches HUD or persisted evidence.

Alternative rejected: remove isolation flags alone (breaks approvals); blanket remote-tool approval;
service-specific Gmail/Drive adapters; opening shell networking for host MCP; forwarding local bearer
or provider credentials to glasses; automatic authorization refresh/login.

## Runtime policy and limits

Keep IPv4 loopback listener, read-only filesystem, shell networkAccess:false and on-request human review.
Host MCP/app networking is independent of the command sandbox. Existing hook trust remains native;
no hooks discovered, no new trust action or assertion that hook process side effects are tool-gated.
Startup of user-installed MCP processes can itself have effects, as in normal Codex: this is a trusted
single-owner environment, not a hostile-server sandbox.

Configuration changes load on restart; dynamic tests use scoped diagnostic overrides rather than edit
normal user config. Production recovery resumes the existing threads with refreshed scoped policy.
Neither exact capability invocation nor physical acceptance is inferred from visibility.

Sources: [app-server](https://learn.chatgpt.com/docs/app-server),
[config reference](https://learn.chatgpt.com/docs/config-file/config-reference), generated 0.157.1 schemas.
The installed RPC name is `item/tool/requestUserInput`; generic `item/tool/requestApproval` does not exist.


## Implementation verification so far

Nested JSON tables are required for thread config overrides with dynamic MCP/plugin identities. Quoted
TOML segments in RPC map keys create literal quote-bearing names and fail transport validation; real
thread/start proved the nested form. Thread overrides of CLI-injected entire server tables can replace
that diagnostic transport; native fake-server tests therefore use an isolated trusted project config.
User/project file configuration remains the supported inherited source. No transport/auth values are copied
into derived overrides. A native Gmail read completed under `writes` policy with no approval request.
The separate `prompt` test declined a real callback before invocation. Side-effect proof remains gated.

Legacy user `notify` is configured separately from hooks/list. Its program/arguments are not copied into evidence; native behavior is preserved, not claimed covered by tool-call approval policy.


ALE-453 safety refinement: ordinary and plugin-bundled MCP tools always use `prompt`, including per-tool overrides. Native `node_repl.js` advertises readOnlyHint despite accepting general code, so annotation-based `writes` is insufficient for opaque MCP runners. Connected apps retain at least `writes` with human reviewer (stricter inherited prompt preserved). This is intentionally stricter than normal read policy for MCP; separate local approval is required even for a harmless MCP read. Tool availability and user-disabled settings are unchanged.

Unclassified host MCP bridges fail closed. The native codex_apps bridge is governed by apps policy; configured MCPs and plugin-owned servers get prompt. This distinguishes policy surfaces, not a provider allowlist.
