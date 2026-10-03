# ALE-465 validation

2026-10-02. Starting Git422bfd06db51e7c3b8bccf24466c2a8977f248b7; worktree/index clean.
Issue and both comments read; In Codex. No release/physical completion claim.

## Stuck production cleanup

Explicit local admin decline returned200, removed sole pending request, but native turn remained active.
Device stop (existing TLS certificate verified by its configured name) returned503 after native RPC
timeout. Admin reconcile200 still reported active native turn. Guarded restart of unchanged gateway/
owned app-server recovered the SAME session/thread/turn as Error/turn_interrupted, uncertain=false,
pending=false. Other sessions remain Done. State backup retained privately; protected config/token/
endpoint hashes unchanged; tunnel/VPN untouched. RestartPID49768. No native action accepted by cleanup.

## Native shape research

Isolated ephemeral native0.157.1 Calculator read probe produced real human MCP elicitation and was
immediately declined. Tool failed, turn completed; no Calculator interaction performed. Observed empty
form, cua_repl get_app_state, exact app target com.apple.calculator, low risk, non-null persist array.
Persistence/one-call lifetime requires additional evidence before enabling an on-glasses accept parser.
No credentials, native raw payload or conversation contents retained in tracked artifacts.

Implementation/tests/cloud/physical: NOT RUN yet.

Recovery health: local authenticated200, codex/loggedIn true; unchanged public endpoint authenticated200,
unauthenticated401. Pending approval count0. git diff --check PASS. Working config remains untracked.
Read-only installed native UI research confirms conversation/always choices; omitted metadata lifetime
unverified. Separate owner authorization requested for isolated read-only lifetime probe. No source/
permission policy edits, no commit/push or cloud deployment yet. Spec/plan/tasks are local drafts.

## Implementation candidate — 2026-10-03

- Root35/35 and AIUI44/44 passed, AIUI syntax/manifest check and private0.5.0 AIX packaging passed.
- Native exact Calculator accept and subsequent decline through the new HTTPS device endpoint passed;
  controls returned only after accept, same ephemeral thread, each decision current/one-use. Strict native
  turnId correlation passed. Diagnostic threads unsubscribed and owned processes terminated.
- Separate omitted-persist lifetime probes: re-prompt without REPL reset, with reset, and in new threads;
  no cross-thread access. Native shape evidence is limited to Calculator get_app_state.
- Native safe MCP auto_review passed (counter1, human0); real unsupported risky simulator immediately
  declined without execution; profile unchanged. Real two-turn restart continuity smoke passed.
- High-risk second confirmation is mock/safe-shape regression proof, not real destructive execution.
- Device timeouts max30s, default DECLINE, back best-effort decline plus authoritative server timeout.
  Native completion grace10s then interrupt;5s without terminal proof gives uncertain error.
- Private config/admin boundary/Camera preserved. Full physical Calculator/screenshot/draft NOT RUN.
  Later native tool approvals outside the verified subset may fail closed and must be reported.
