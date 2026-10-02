# ALE-453 validation evidence

Date: 2026-10-02. Current runtime commit 08ab1a4 (initial implementation 10d0c6b); production gateway updated with accepted Jarvis AIX 1.0.19 unchanged.

| Gate | Result | Evidence / limit |
|---|---|---|
| Inventory before runtime changes | PASS | Sanitized inventory.json; isolated stdio + ephemeral thread with production environment allowlist |
| Native Gmail read | PASS, diagnostic only | get_profile tool completed; no personal result logged; writes policy no approval, prompt policy declined before execution |
| Unit/integration | PASS | 28 root tests incl policies, auth/loopback, history/dedupe/recovery, pending MCP approval and negative cases |
| AIUI unchanged regression | PASS | 36 tests; no frontend/runtime/private AIX changes |
| Real continuity smoke | PASS | thread 01a0fdda-9955-79e0-838d-813b026bf123, two completed turns across gateway/app-server restart, synthetic project |
| Native write approval | PASS, harmless fixture | Real model turns/MCP with in-memory counter: decline → 0, explicit local test accept → 1; native mcp_tool_call marker observed |
| Dynamic configuration | PASS, scoped fixture | Existing node_repl disabled → zero tools; enabled after new process → connected/four tools; global user config unchanged |
| Production Gmail READ | PASS (Mac-triggered) | gmail.search_email_ids + gmail.batch_read_email completed, same Jarvis session/thread, Done |
| Production GitHub READ | PASS (Mac-triggered) | github.fetch_file completed, Done |
| Production MCP | PASS on 10d0c6b; final prompt policy NEEDS TEST | existing node_repl.js arithmetic read completed; subsequent security refinement requires explicit local approval for every opaque MCP call |
| Production skill | PASS (Mac-triggered) | speckit-analyze SKILL.md read, prerequisites executed, feature artifacts read; six command items, completed turn |
| Production Drive READ | NOT RUN | Awaiting owner-selected safe document |
| Production deployment | PASS | initial PID37467, final gateway PID41540, 127.0.0.1:8390; health true; three existing sessions/thread/history counts retained; protected configuration hashes unchanged |
| Real Gmail draft approval | DENIAL PASS; ACCEPT NOT RUN | Production get_profile completed; exact self-recipient/subject/body verified privately; create_draft waited on native approval and failed after owner confirmation timed out. No draft created or email sent |
| Physical Jarvis tool parity | NOT RUN | Accepted UX baseline 1.0.19 preserved; this feature still needs wearer tests |

Resolved diagnostic failures: quoted TOML segments in thread RPC keys caused invalid transport;
nested JSON overrides fixed it. A CLI-only fake server definition was overwritten by a nested thread
policy; the fixture now declares its transport in a temporary trusted project file. Project trust CLI
keys use native raw path segments, not literal quote-bearing names. Initial sandbox EPERM on loopback
was an execution-environment restriction; authorized local tests then ran.

Surface limitations: standalone Vercel MCP needs authentication; native codex_app/code-review host
services disabled; provider catalog metadata timeout observed; unsupported native input/auth approval
forms fail closed. No claim of universal Desktop tool parity or credential availability from environment
variables stripped by the existing child allowlist. No new provider login, hook trust, unrestricted shell
networking or public cloud publication performed.


Production runtime visibility: 18 callable apps and codex_apps connected with 552 tools in the existing
Jarvis thread. node_repl/cua_repl connected; user-disabled computer-use disabled. codex_app/code-review
Desktop helpers fail with zero tools on this production surface (diagnostic launch previously reported
disabled), and standalone Vercel MCP remains authenticationRequired. These are explicit limits.

The first restart checker used 127.0.0.1 for an HTTPS listener bound to its configured LAN address,
so reported replacement_not_ready despite successful startup. Verification against the existing configured
address passed; no second gateway/tunnel restart or config mutation was required. Device/admin TLS/auth
boundaries are unchanged. Cloud update/resource reload is unnecessary for this backend feature.

Physical reads and real draft acceptance remain NOT RUN; the Mac-triggered production checks do not
prove HUD/TTS for provider results. Full task remains Needs Test in Linear, not Done.

Security review found native node_repl.js readOnlyHint=true despite arbitrary code capability. Ordinary/plugin MCP policy tightened to prompt for every call; connected apps retain writes/human. Final production MCP read therefore needs a separate owner decision after redeploy.

Final pending draft request expired without owner approval; no approval handle remains. Re-run that test only with a fresh native request and an explicit local decision. Awaiting owner-selected safe Drive document and physical Jarvis acceptance.
