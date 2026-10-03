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

- Root35/35 and AIUI45/45 passed, AIUI syntax/manifest check and private0.5.0 AIX packaging passed.
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

Cloud metadata reports layout480×168. Approval uses compact typography/spacing, hides the redundant
brand/history while the card is present and restores the same history projection afterwards. This is
layout preparation, not a claim of physical readability; wearer acceptance remains required.

## Deployment / physical handoff — 2026-10-03

Implementation02feecefa0e6d5bf4d4d1a0d7413571a38fcbd8e pushed main; compact frontend3a8facb pushed.
Production gatewayPID64563 started from02feece; src/ tree unchanged by compact frontend commit.
All3 session/thread mappings retained, private config/token/endpoint hashes unchanged, pending0, native
workspaceWrite/on-request/auto_review profiles intact. Public health authenticated200 / unauthenticated401.
No Cloudflare/VPN/account/permission change. Previous interrupted turn remains terminal and certain.

Private cloud Upload/Repackage/Save completed for existing Jarvis draft. ACTIVE version1.1.3 downloaded
and MD5 verified01828f6e57470b3df4379eec3feb5855; AIX VERSIONfa6defdc-f4a9-41ff-a783-dcef5d1c1851.
Runtime files including approval-ui.js and compact Ink page match current source byte-for-byte; manifests
match structurally; private config matches staging and working config in memory. Network/Camera/
Microphone/Speaker retained. No Submit for Review/publication. Private download remains ignored.

Root35/35, AIUI45/45, check/private packaging, real native Calculator device API, safe auto_review,
unsupported native fail-fast, restart continuity and source/index/reachable-history secret scans PASS.
Physical RV101 approval/card/TTS/full Calculator→screenshot→draft acceptance: NOT RUN. Candidate ready
for wearer update; Linear Needs Test. Later unsupported native action types remain a deliberate limit.

## Owner-requested checkpoint — 2026-10-03

Work paused at owner request before release verification/deployment. Base main b1adb3402a704b549bdf4902f6dd4af10137fa25.
Implemented locally: generic bounded native approval classes, FIFO/current-turn decision binding;
per-exchange failed/interrupted/uncertain/no-answer outcomes and immediate denial feedback; generic
HUD scope/action/target and terminal TTS; private bounded native-image file handoff through public
expectedTurnId-bound steer. Imported owner threads retain existing developer instructions.

Latest checkpoint-targeted checks:35 gateway/core tests and33 AIUI tests PASS. Earlier full suites
reached48 root/47 AIUI PASS, before subsequent security hardening; do not present those older full-suite
results as final release verification of this checkpoint. AIUI syntax/manifest check passed earlier.

Native evidence: Calculator actual50 and JPEG; self-draft attachment/readback with exact bytes; final
PUBLIC API same-turn workflow passed with normal profile, no send, clean voice history and temporary
cleanup. These probes preceded the last parser/cleanup/format hardening; no new native probe was run
for checkpoint. The Screenshot utility's app-access request reached and was accepted by the generic
device endpoint, but its subsequent native CUA execution failed. Direct Calculator-window capture passed.

No cloud/package/deploy in this revision. Production remains old backend02feece / AIX1.1.3; source
package version0.6.0 is not yet packaged/deployed/read back. Physical approval-card selection was accepted
on1.1.3, but generalized classes/new outcome handling/full revised workflow still need physical testing.

Remaining: bounded final release checks, private local package, matching gateway/AIX deployment and
ACTIVE readback, then physical acceptance. Known separate surface limit: Screenshot utility execution
after approval (not the approval router); do not claim arbitrary desktop-capture support from window proof.
No further research/probes/cloud work is authorized by this checkpoint instruction.

Checkpoint file inventory (including new files):

```text
.specify/memory/constitution.md
AGENTS.md
AIUI_SETUP.md
ARCHITECTURE.md
RUNBOOK.md
aiui-agent/AGENTS.md
aiui-agent/lib/approval-ui.js
aiui-agent/lib/gateway.js
aiui-agent/lib/history.js
aiui-agent/lib/voice-ui.js
aiui-agent/package-lock.json
aiui-agent/package.json
aiui-agent/pages/index/index.ink
aiui-agent/test/approval-ui.test.mjs
aiui-agent/test/gateway.test.mjs
aiui-agent/test/integration.test.mjs
aiui-agent/test/page.test.mjs
scripts/device-approval-smoke.mjs
specs/005-ale-465-device-approval/contracts/approvals.md
specs/005-ale-465-device-approval/data-model.md
specs/005-ale-465-device-approval/plan.md
specs/005-ale-465-device-approval/research.md
specs/005-ale-465-device-approval/spec.md
specs/005-ale-465-device-approval/tasks.md
specs/005-ale-465-device-approval/validation.md
src/approvals.mjs
src/engine.mjs
src/history.mjs
src/image-artifacts.mjs
test/approval-device.test.mjs
test/approval-router.test.mjs
test/history.test.mjs
test/image-artifacts.test.mjs
test/integration.test.mjs
```
