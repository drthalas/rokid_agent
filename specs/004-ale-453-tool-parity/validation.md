# ALE-453 validation evidence

Date: 2026-10-02. Candidate atop 5e38d93; production not yet updated at this checkpoint.

| Gate | Result | Evidence / limit |
|---|---|---|
| Inventory before runtime changes | PASS | Sanitized inventory.json; isolated stdio + ephemeral thread with production environment allowlist |
| Native Gmail read | PASS, diagnostic only | get_profile tool completed; no personal result logged; writes policy no approval, prompt policy declined before execution |
| Unit/integration | PASS | 27 root tests incl policies, auth/loopback, history/dedupe/recovery, pending MCP approval and negative cases |
| AIUI unchanged regression | PASS | 36 tests; no frontend/runtime/private AIX changes |
| Real continuity smoke | PASS | thread 01a0fdda-9955-79e0-838d-813b026bf123, two completed turns across gateway/app-server restart, synthetic project |
| Native write approval | PASS, harmless fixture | Real model turns/MCP with in-memory counter: decline → 0, explicit local test accept → 1; native mcp_tool_call marker observed |
| Dynamic configuration | PASS, scoped fixture | Existing node_repl disabled → zero tools; enabled after new process → connected/four tools; global user config unchanged |
| Production Gmail/Drive/GitHub/MCP/skill | NOT RUN | Must use current gateway/thread after safe deployment |
| Real Gmail draft with owner approval | NOT RUN | No real draft/write executed by diagnostic tests |
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
