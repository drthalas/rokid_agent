# Tasks: ALE-453 permission parity revision

This replaces the earlier human-only implementation plan at4e8d784. Earlier capability proofs remain
historical evidence in validation.md; superseded policy is not current acceptance.

## Phase1 — Normal environment evidence
- [x] T023 Read normal user/effective config and current Desktop turn policy; record sanitized profile evidence under this feature.
- [x] T024 Prove normal workspace and safe Desktop elevation using new exclusive test files; no overwrite.
- [x] T025 [US4] Prove Browser/Computer capability paths using isolated app-server; record exact limits in research.md.
- [x] T026 Update existing spec/plan/contracts/data-model and requirements checklist for native auto-review.

## Phase2 — Tests before implementation
- [x] T027 [US1] Replace forced-policy tests in test/tool-policy.test.mjs and protocol/integration tests with native inheritance, disabled state and no Full Access guarantees.
- [x] T028 [US2] Add normal workspace/auto-review proof and network/roots assertions in native validation tooling.
- [x] T029 [US3] Test immediate pending timing, no default120s expiry, explicit-timeout compatibility, native review notifications never imply accept, stale/cancel/unknown requests in tests.
- [x] T030 [US3] Verify existing AIUI pendingApproval hint without modifying runtime/AIX in aiui-agent/test/page.test.mjs.

## Phase3 — Implementation
- [x] T031 [US1] Remove Jarvis app/MCP/plugin approval clamps in src/codex.mjs and src/tool-policy.mjs; keep native disabled-state verification.
- [x] T032 [US2] Adopt selected workspace-write/on-request/auto_review profile and inherited turn sandbox in src/protocol.mjs; do not add Desktop roots.
- [x] T033 [US3] Implement native review metadata/pending semantics in src/engine.mjs, src/tool-evidence.mjs and local admin inspection; retain no voice/manual auto-accept.
- [x] T034 [US1] Update isolated inventory/smoke/dynamic scripts to validate current native policy without permanent user config edits.

## Phase4 — Verification / delivery
- [x] T035 Run root and AIUI regression checks, real native safe elevation and harmless human/denial probes; document evidence limits in validation.md.
- [x] T036 Update architecture/runbook/workflow/constitution where prior human-only/read-only policy conflicts with the owner's explicit revision.
- [ ] T037 Scan source/index/history, review diff, commit/push referencing ALE-453.
- [ ] T038 Restart production only when idle, preserving protected files, session/thread and loopback; record runtime commit/health/rollback.
- [ ] T039 [US1] Execute A–I through production gateway and update validation.md; no email send or real destructive action.
- [ ] T040 [US4] Execute Browser/Computer safe reads or document exact app-server surface/permission limitation; do not substitute shell.
- [ ] T041 [US3] Measure genuine pending visibility and prove no gateway-generated accept for unsafe/native-human requests; distinguish simulated/native evidence.
- [ ] T042 Physical Jarvis acceptance with owner; Linear Needs Test until passed.

Dependencies: T023–T026 before runtime changes; T027–T030 before T031–T034; native/regression checks
before T038. State-changing tests are limited to the owner-authorized files/draft. Unsupported native
surfaces are recorded, not approximated by elevated shell. Test fixtures never execute destructive operations.
