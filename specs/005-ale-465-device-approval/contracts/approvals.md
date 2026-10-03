# Device approval contract

Snapshot adds `approval:null|{id,turnId,kind,title,description,risk,allowOnGlasses,expiresAt}`.
Existing pendingApproval boolean, session/history/status remain compatible.

POST /v1/sessions/:sessionId/approvals/:approvalId
Existing device bearer, JSON body `{decision:"accept"|"decline",confirmation?:string}`.
No admin token; no raw native args accepted. Unknown fields/decision400; missing/foreign/stale/resolved/
expired/not-busy handles409; unsupported handles never created. Auth401/Origin403 unchanged.
Accept low/medium: native single-request accept then `{ok:true}`.
Accept high without confirmation: `{requiresConfirmation:true,confirmation:<opaque challenge>}`;
no native answer. Second explicit accept requires matching challenge. Decline is always immediately
available; expiry invalidates challenge. Never acceptForSession, native persistence or scope session.

Auto-review notification is not a human request. Unknown command/file/permission/complex MCP forms
fail closed unless their entire concrete action and grant lifetime are safely representable. Neither
risk metadata nor a Calculator substring is sufficient evidence. Secret-free fixed descriptions only.
