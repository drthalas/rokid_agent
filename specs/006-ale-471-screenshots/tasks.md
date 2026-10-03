# Tasks — ALE-471
## Setup and foundations
- [x] T001 Trace native screenshot/provider and Gmail contracts in research.md.
- [x] T002 Define private capture and handoff contracts in contracts/screenshots.md.
## US1 — app result (independent proof: visible50 and unsent attachment)
- [x] T003 [US1] Regress and fix latest-result retention in test/image-artifacts.test.mjs and src/image-artifacts.mjs.
- [x] T004 [US1] Explicitly route app result capture and current-turn attachment in src/screenshot-instructions.mjs and src/engine.mjs.
## US2 — full desktop (independent proof: full-display image and unsent attachment)
- [x] T005 [US2] Add private noninteractive capture, image validation and cleanup lease in src/desktop-capture.mjs and scripts/desktop-capture.mjs.
- [x] T006 [US2] Test capture args, malformed output, permissions and TTL/cleanup in test/desktop-capture.test.mjs.
## US3 — safe errors/completion
- [x] T007 [US3] Test routing and stage-specific error instructions in test/screenshot-instructions.test.mjs; preserve existing approval tests.
- [x] T008 [US3] Prove both real native flows, exact image handoff, self recipient, DRAFT and cleanup in scripts/screenshot-smoke.mjs.
## Checkpoint
- [x] T009 Run affected checks, review diff/new files and document evidence in validation.md, ARCHITECTURE.md and RUNBOOK.md.
- [ ] T010 Only after both real proofs pass: scan index/reachable history, update ALE-471, commit/push checkpoint; stop before release.

Dependencies: T001→T002; T003→T004; T005→T006; T004+T006→T007→T008→T009→T010. US1 is the first incremental result; both stories required for checkpoint. Independent test authoring for US1/US2 can proceed in parallel, but shared engine edits and physical desktop probes are sequential.
