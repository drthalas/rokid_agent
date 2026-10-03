# Device approval contract

Snapshot adds `approval:null|{id,turnId,kind,title,description,risk,allowOnGlasses,expiresAt}`.
Existing pendingApproval boolean, session/history/status remain compatible.

POST /v1/sessions/:sessionId/approvals/:approvalId
Existing device bearer, JSON body `{decision:"accept"|"decline",confirmation?:string}`.
No admin token; no raw native args accepted. Unknown fields/decision400; missing/foreign/stale/resolved/
expired/not-busy handles409; unsupported handles never created. Auth401/Origin403 unchanged.
Accept low/medium ordinary scope: native single-request accept then `{ok:true}`.
Accept high OR scope=app without confirmation: `{requiresConfirmation:true,confirmation:<opaque challenge>}`;
no native answer. Second explicit accept requires matching challenge. Decline is always immediately
available; expiry invalidates challenge. Never acceptForSession or scope session; the only native persistence is the exact-app response below.

Auto-review notification is not a human request. Unknown command/file/permission/complex MCP forms
fail closed unless their entire concrete action and grant lifetime are safely representable. Neither
risk metadata nor a Calculator substring is sufficient evidence. Secret-free fixed descriptions only.

## Current generic descriptor / outcome contract (source0.6.0)

Descriptor fields: id,turnId,kind,title,action,target,risk,scope,allowOnGlasses,expiresAt. Kinds:
computer-use/command/file-change/permissions/mcp-tool. Scope once except validated permissions=turn and verified CUA app consent=app;
never session. Action≤72 and target≤96 characters, no hidden truncation. Complete small patch preview
includes hunk locations/changed lines; app IDs are targets, not allowlist policy. Unsupported/opaque
sensitive payloads remain fail-closed. Four pending native requests may queue; only the FIFO head is
decidable and has a30s clock. Negative decision/overflow/unsupported cancels remaining queued requests
and bounded continuation cannot be restarted by further approvals.

Snapshot adds approvalStopping and per-exchange outcome/approvalNotice. completed remains the native
completion flag; assistant is readable for failed/interrupted/uncertain/no-answer outcomes too. Reasons
survive next turn/reopen/hydration. Immediate STOPPING does not release the busy/uncertain lock.

Private generated image data has no device route. A successful CUA image can produce bounded temporary
JPEG/PNG plus public turn/steer metadata tied to exact expectedTurnId. It is marked untrusted data and
never approves an action; canonical user text stays the original gateway prompt. Normal cleanup and
TTL run while healthy; crash/persistent filesystem failures may leave private temp residues.

The frontend displays remaining decision time using the snapshot server clock (presentation only;
the gateway's deadline remains authoritative). Expired cards cannot send a delayed Accept. A failed
or ambiguous decision ACK is reconciled with GET, never automatically replayed; a still-current card
remains visible, defaults NO and requires another deliberate choice. ERROR/CANCELLED expose a short
current-turn explanation above history, so a long request cannot conceal the terminal reason.
Local-only bounded runtime review evidence records sanitized kind/action/target and the native response
sent (Accept/Decline and reason). This is response evidence, never proof that the tool executed.

## Native exact-app consent

Require cua_repl/form, empty supported schema, codex_approval_kind=mcp_tool_call,
connector_id=computer-use, known native app operation, sole tool_params.app canonical bundle ID and
exact persist options session/always. No one-time app-consent choice. Client provides no app identity
or native metadata; immutable native request supplies the binding. Unknown variants fail closed.
After the second matching current-request confirmation only, send
`{action:"accept",content:{},_meta:{persist:"always"}}`. Decline remains `{action:"decline",content:null}`.
Persistent choice is metadata, not a field invented in the empty requestedSchema. Native provider owns
the saved exact-app trust for future tasks. Local admin direct accept cannot grant this scope. Ordinary
MCP/command/file/permissions responses never inherit persistence metadata.
