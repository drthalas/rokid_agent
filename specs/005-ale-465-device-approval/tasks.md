# Tasks: ALE-465 human approval on Jarvis

## Phase1 — Setup and research
- [x] T001 Decline/reconcile stuck production turn; record safe evidence in validation.md.
- [x] T002 Specify scope and review checklist in spec.md and checklists/requirements.md.
- [x] T003 Verify native scope/persistence semantics and finish research.md; block enabling unproven shapes.

## Phase2 — Foundations
- [x] T004 Add sanitizer/security tests in test/approval-device.test.mjs before production changes.
- [x] T005 Implement verified fixed descriptors/native shape exclusions in src/approvals.mjs.
- [x] T006 Amend explicit device-human decision boundary in AGENTS.md, ARCHITECTURE.md and .specify/memory/constitution.md.

## Phase3 — US1 explicit wearer choice
Independent test: safe current approval allowed once, foreign/repeated/stale zero execution; high-risk two stages.
- [x] T007 [US1] Test session/turn/expiry/auth/high-risk binding in test/approval-device.test.mjs.
- [x] T008 [US1] Add bounded memory-only handles and strict device decision in src/engine.mjs and src/server.mjs.
- [x] T009 [P] [US1] Test default-decline, stale key, double-tap/back and TTS once in aiui-agent/test/page.test.mjs.
- [x] T010 [US1] Add descriptor validation/non-replayed decisions in aiui-agent/lib/gateway.js.
- [x] T011 [US1] Implement APPROVAL card, physical-only controls and high-risk second step in aiui-agent/pages/index/index.ink and lib/voice-ui.js.

## Phase4 — US2 bounded denial
Independent test: expiry/unknown form decline, same-turn conclusion or explicit uncertain state, never opaque wait.
- [x] T012 [US2] Test unsupported, timeout, disconnect and cancellation races in test/approval-device.test.mjs.
- [x] T013 [US2] Add30s expiry, fixed outcome and bounded completion/interrupt in src/engine.mjs.
- [x] T014 [US2] Render cancellation/error notices and best-effort back decline in AIUI page/client.

## Phase5 — US3 regression and delivery
Independent test: native safe review remains automatic; existing session/history/UX regressions pass.
- [x] T015 [US3] Adapt and run native safe request/decline proof in scripts/device-approval-smoke.mjs.
- [x] T016 [US3] Run root/AIUI/check/packaging and real continuity/auto-review smoke; record validation.md.
- [x] T017 Update AIUI_SETUP.md/RUNBOOK.md/context-map/setup-status with bounded approval workflow.
- [x] T018 Review diff and scan candidate/index/history; commit/push main referencing ALE-465.
- [x] T019 Restart idle gateway preserving config/session/thread, private Upload/Repackage/download active AIX; verify exact runtime/private config.
- [x] T020 Record Git/runtime/cloud evidence in validation.md and Linear Needs Test; physical acceptance separately.

Dependencies: T001 before implementation; T003 before T005; tests before implementation; server contract
before client integration. T009 can be prepared separately from backend tests. Implement smallest safe
subset, fail closed for unknown shapes; do not broaden native permission profile for acceptance.

## Revision after physical failure
- [x] T021 Research current native class/schema/scope matrix and real action shapes in research.md.
- [x] T022 [US2] Reproduce silent outcome loss in test/history.test.mjs and approval-device tests.
- [x] T023 [US2] Persist per-exchange outcome/approval reason and recovery merge in src/history.mjs and src/engine.mjs.
- [x] T024 [US1] Add shape-based generic descriptor router/context validation in src/approvals.mjs and engine; security regression tests.
- [x] T025 [US1] Consume action/target/scope descriptor in aiui-agent/lib/approval-ui.js and page without app-name policy.
- [x] T026 [US2] Add immediate denial feedback, canonical failure HUD/TTS and restore/idempotency tests in AIUI client/page.
- [x] T027 [US3] Prove actual isolated Calculator interaction, screen capture and Gmail attachment or record exact boundary in validation.md.
- [ ] T028 Run affected tests/check/pack/native smoke; review/update docs/security/Spec Kit artifacts.
- [ ] T029 Scan index/history, commit/push, update idle gateway/private AIX, verify ACTIVE runtime/config.
- [ ] T030 Update Linear Needs Test with actual class coverage and physical handoff; no physical PASS claim.
- [x] T031 [US3] Test and implement bounded native-image temporary artifact handoff in src/image-artifacts.mjs and engine; no new capture/provider client or authority.
- [x] T032 [US3] Re-run full SAME-turn Calculator→native screenshot→attached draft with exact image-byte proof; record actual native boundary if unsuccessful.

Checkpoint paused by owner2026-10-03: implementation/targeted tests saved; T028–T030 remain release/deploy/physical handoff work. No new native or cloud cycle during checkpoint.

## Native exact-app persistent consent checkpoint
- [x] T033 Capture actual native request and Desktop response metadata; prove native store persistence.
- [x] T034 Prove new user turn Calculator20+30=50 + image with zero app-consent prompts.
- [x] T035 Implement strict scope=app sanitizer/response and mandatory second current-request challenge.
- [x] T036 Implement DECLINE/ALWAYS ALLOW HUD, future-task disclosure and default-NO second screen.
- [x] T037 Targeted exact identity/unsupported/replay/normal/high-risk tests and native safe risk fixture.
- [x] T038 Finish diff/secrets review, evidence and commit/push coherent checkpoint.
- [ ] T039 Next phase: release verification, one private deploy/readback and separate physical acceptance.
