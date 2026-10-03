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
- [ ] T018 Review diff and scan candidate/index/history; commit/push main referencing ALE-465.
- [ ] T019 Restart idle gateway preserving config/session/thread, private Upload/Repackage/download active AIX; verify exact runtime/private config.
- [ ] T020 Record Git/runtime/cloud evidence in validation.md and Linear Needs Test; physical acceptance separately.

Dependencies: T001 before implementation; T003 before T005; tests before implementation; server contract
before client integration. T009 can be prepared separately from backend tests. Implement smallest safe
subset, fail closed for unknown shapes; do not broaden native permission profile for acceptance.
