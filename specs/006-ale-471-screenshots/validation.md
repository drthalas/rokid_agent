# ALE-471 screenshot checkpoint — 2026-10-03

SESSION: NEW SESSION. Actual agent MODEL: gpt-6-astra; EFFORT: high (native turn_context; requested Medium).
Real proof model: gpt-6-astra. WHY: separate screenshot routing from validated persistent app consent.
Base main:953a790cd2d782cf0acadb71dc97be6882c14d47. Current checkout; pre-existing ALE-465 validation.md
change preserved and excluded from this checkpoint. No frontend/cloud/approval/persistence changes.

## Diagnosis and implementation
Physical thread trace at19:26:34Z directly invoked `cua.getApp('com.apple.screencaptureui')`.
Gateway instructions did not distinguish desktop capture from app-window images. Installed CUA getApp
and getAXState emit text only; getScreenshot emits the image. No desktop helper existed. The first-two
image cap could discard later results; this risk is reproduced/regressed but is not asserted as the
cause of the owner's specific failed20+30 turn. A later historical Calculator99→draft flow succeeded
after one native reviewer timeout, demonstrating existing Gmail attachment transport was available.

App path now explicitly performs action→verifies result→CUA getScreenshot→current-turn/item metadata
and private file→existing Gmail multipart MIME connector. Export retains newest two distinct images
rather than first two, preserving global bounds, native private cleanup and failure capacity accounting.
Desktop path invokes the fixed noninteractive screencapture CLI through native exec, validates PNG
bounds and native sips decode, and returns private metadata. No Screenshot UI/ScreenCaptureKit added.
Helper lease is0700/file0600; explicit cleanup plus independent ten-minute cleanup process. Abrupt OS
failure, pre-lease process death or persistent filesystem failure is not a crash-proof retention promise.
Explicit terminal capture/attachment error guidance; general ERROR recovery remains ALE-469 scope.

## Real local proofs
Both ran sequentially through real Engine + isolated ephemeral native app-server thread. No direct
mcpServer/tool/call writes, synthetic approvals, fabricated images, production restart or provider swap.

| Proof | Result | Evidence |
|---|---|---|
| Calculator20+30 image | PASS | CUA JPEG230×408; visually inspected20+30 and50;27,139bytes |
| Current-turn image identity | PASS | Exact turn/item steer; source image and MIME attachment SHA256 equal |
| Calculator Gmail draft | PASS | Self-recipient/no CC/BCC; `ALE-471-calculator.jpg`, image/jpeg27,139bytes; DRAFT readback |
| Full desktop capture | PASS | Actual full display PNG1920×1080,625,131bytes; menu bar, desktop/window composition and Dock visually inspected |
| Desktop Gmail draft | PASS | Self-recipient/no CC/BCC; `ALE-471-desktop.png`, image/png625,131bytes; DRAFT readback |
| Email sent | NO | No send tool invoked; both messages independently reread as DRAFT |
| Temporary cleanup | PASS | CUA owned files removed; no desktop lease dirs remain; manual probe and verification image copies deleted |
| Persistent approval behavior | PASS | 0 native human requests; workspaceWrite/on-request/auto_review; native auto-review approved events present |

Source/attached Calculator SHA256:dac820fbd780a10c3c6f0398c409d07365eaaa6c03877a9b7281ce712440bc1b.
Desktop attachment SHA256:36d0eb13f9be4b5b11a408b42b49268b3d537f1f25088e3129b21d732d5f91a9.
Both attachments additionally downloadable through Gmail read_attachment (no provider error).
Private draft identifiers remain in private evidence, not public source. Drafts intentionally remain unsent.
Proof screenshots are not retained locally. The checked-in smoke runner now deletes its verification
copies after native decode and returns failure status when its assertion set fails; that runner-only
cleanup/assertion refinement was syntax-checked after the completed real run.

## Permission evidence
Initial direct CLI invocation in execution sandbox failed: could not create image from display.
Same CLI through normal native require_escalated/auto_review succeeded without interactive capture UI
or any TCC change. Read-only CGPreflightScreenCaptureAccess returned true. This desktop-chat launch
chain was ChatGPT.app (signed bundle com.openai.codex)→bundled CodexCLI→shell→capture binary.
Existing daemon has a distinct launchd→node→/opt/homebrew/bin/codex chain; actual-daemon capture-only
verification is recorded below, separately from these two isolated full attachment proofs.

## Checks and scope
- Capture/image tests12/12 PASS; isolated approval regressions26/26 PASS.
- Stable affected integration/policy/approval/capture/routing suite49/49 PASS.
- Initial loopback tests: environment failure (sandbox EPERM); rerun with native authorized loopback PASS.
- Instruction mock fixture initially lacked ready/recovered setup; corrected fixture, routing test PASS.
- Desktop capture helper real native decode PASS. Independent expiry and ownership/cleanup tests PASS.
- No new package dependency or lockfile change. No full release matrix, packaging, deploy or physical test.
- Diff/secret scan and final Git checkpoint recorded below.

Remaining phase: release verification→private deploy→physical RV101 acceptance.

## Actual daemon capture-only permission proof
Existing app-server89562 under launchd-owned gateway node89561 (binary /opt/homebrew/bin/codex),
without restart or deployment, accepted an isolated ephemeral native turn. Same helper: first sandbox
execution exit1; native auto-review approved escalation; second execution exit0 with real PNG1920×1080,
621,332bytes; explicit cleanup exit0 and directory absent. Zero human requests/new app grants. Native
workspaceWrite/on-request/auto_review profile preserved. No extra Gmail draft in this check. Thus both
local attachment proofs and the actual daemon capture launch context are verified. No one-time owner
Screen Recording provisioning was needed on this Mac; capture executable is /usr/sbin/screencapture.
Do not infer portable TCC grants for another machine/account/launch context.

## Review and secret scan
Reviewed tracked diff and all new files; git diff --check PASS. Index and all reachable Git history
scanned with gitleaks: the same two reviewed pre-existing synthetic/documentation false positives
(approval-router fixture and ALE-465 validation narrative), no real/new findings. Current device/admin
secret equality check on changed index: no matches. No private images/config/credentials staged.
GitHub main still953a790 before integration. Pre-existing ALE-465 validation diff remains unstaged.

## Session/context snapshot
Native rollout snapshot before checkpoint: model gpt-6-astra, effort high (requested Medium; no runtime
model setting changed). Last request input159,336 / context window828,400 =19.23%; these are exposed
request-context counters, not an estimate of transcript size. Cumulative root-thread input3,862,169,
cached input3,700,736, output26,509 (reasoning5,057 included); snapshot excludes later checkpoint work
and isolated smoke/subagent usage. Exact model-response count UNAVAILABLE; visible rollout snapshot
had9 assistant-message records and34 top-level tool-call records. Recommendation NEW SESSION for
release→private deploy→physical acceptance.
