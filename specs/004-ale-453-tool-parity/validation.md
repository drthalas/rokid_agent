# ALE-453 validation — current native permission revision

2026-10-02 owner revision supersedes prior read-only/user/blanket-prompt constraints.
Runtime updated to d813d42; prior evidence below identifies the older08ab1a4 iteration.

| Gate before deployment | Result / evidence |
|---|---|
| Normal Desktop effective mode | turn_context on-request/auto_review, managed workspace semantics plus per-chat auxiliary roots |
| Normal zero-override native config/thread | workspace-write/on-request/auto_review; shell network false; additional writable roots[]; no Desktop root |
| Normal workspace / Desktop safe write | PASS; exclusive new Hello World files, Desktop operation through current App's elevated review |
| Gateway root tests | 30/30 PASS |
| Accepted AIUI regression | 37/37 PASS; runtime/config/AIX unchanged |
| Native workspace write | PASS, no human request/review needed |
| Native outside/Desktop write | PASS, command auto-review approved/low; zero human requests; no roots workaround |
| Native MCP auto-review | PASS, in-memory write counter1; zero gateway-generated accept/human prompt |
| Dynamic MCP/config | PASS, node_repl disabled0 tools / enabled4 tools across separate processes; native app prompt setting preserved |
| Real restart continuity | PASS, two turns retained thread01a0fe7f-1674-75b1-86db-80d67ffb7e39 across restart |
| Browser Chrome | PASS via app-server cua_repl; Example Domain title in tool result, test tab closed |
| Built-in IAB | SURFACE LIMITATION: native “Browser is not available: iab”; no substitute used |
| Computer Use | PASS after explicit owner Calculator grant; initial denial blocked access, subsequent controls read succeeded without input |
| Remaining human flow | Mock unsafe-shaped request pending immediately (<100ms assertion), no default expiry, explicit decline; actual native Calculator permission independently required owner |
| Destructive execution | NOT RUN; prohibited by test design |

Current production matrix/physical acceptance will be appended after deployment. Native review denial
need not generate a new human RPC; do not claim arbitrary unsafe-action classification from a harmless
fixture. Unknown auth/input/special-root grant shapes remain unsupported and are never fabricated.

## Production native permission result

Runtime d813d42, gateway PID67133; same three sessions/thread IDs preserved, config/token/tunnel hashes
unchanged, AIX1.0.19 unchanged. Actual resumed profiles and subsequent turn_context both confirm
workspace-write/on-request/auto_review, shell network restricted, no Desktop writable root.

| Production case | Evidence |
|---|---|
| Workspace file | PASS: .local/jarvis-workspace-permission-test.txt = Hello World; no human request |
| Desktop file | PASS: ~/Desktop/jarvis-test.txt = Hello World; native command auto-review approved/low in3392ms |
| Gmail draft | PASS: create_draft completed; recipient checked against get_profile, exact Jarvis Test / Hello from Jarvis; read_email readback confirms DRAFT; no send tools |
| Gmail read | PASS: search_email_ids + batch_read_email completed |
| Drive read | PASS: google_drive.search metadata read completed (not a document-write/body-read claim) |
| Calendar read | PASS: google_calendar.list_calendars completed |
| GitHub read | PASS: github.fetch_file completed |
| Linear read | PASS: linear.get_issue completed |
| MCP | PASS: existing node_repl.js completed with native auto-review approved/low; no forced local prompt |
| Skill | PASS: speckit-analyze SKILL.md and prerequisites actually read/executed |
| Chrome | PASS: production cua_repl returned Example Domain in actual tool result |
| Computer | PASS: production Calculator control read; owner-authorized native app grant only, no input |
| Human pending | PASS: real native Calculator request, no default expiry; state0ms / first snapshot poll983ms |
| Risky confirmation | PASS native request/pending/decline path through a non-executing MCP simulator; no destructive handler or real deletion; not a universal risk-classification claim |

Surface differences: built-in IAB unavailable (“Browser is not available: iab”); Desktop-only
codex_app/code-review host services unavailable on standalone launch; standalone Vercel MCP needs
its own existing native authentication. Chrome/Computer need the configured Desktop-backed bridge;
Computer app grants can require a human independently of auto-review. Native TUI /approve retry for
a denied action has no exposed equivalent in the inspected app-server request schema.

Filesystem detail: Desktop session injects a visualization writable root and a project .aws read-only
guard. Jarvis's native workspace-write profile lacks those UI-specific entries (project .aws is absent).
No custom second permission profile or Desktop root workaround was added. This difference is disclosed;
bit-for-bit Desktop filesystem policy equivalence is not claimed. Auth/loopback/secret filtering and
all tested ownership/recovery boundaries remain intact.

Physical write/permission acceptance is pending; baseline Jarvis UX/Gmail read was owner-accepted.
Linear remains Needs Test, not Done.

## Historical capability iteration (superseded policy)


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
