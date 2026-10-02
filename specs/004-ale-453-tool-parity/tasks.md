# Tasks: ALE-453 Codex Tool Parity

Input: [plan](plan.md), [spec](spec.md), [research](research.md), [contracts](contracts/approvals.md).

## Phase 1 — Setup/inventory
- [x] T001 Inspect baseline, instructions and effective environment; record sanitized `specs/004-ale-453-tool-parity/inventory.json`.
- [x] T002 Prove app-server discovery separately from Desktop; document limitations in `specs/004-ale-453-tool-parity/research.md`.
- [x] T003 Generate spec/plan/data-model/contracts/quickstart with Spec Kit under `specs/004-ale-453-tool-parity/`.

## Phase 2 — Security foundations
- [x] T004 Write negative approval policy tests in `test/tool-policy.test.mjs`: preserve disabled states/lists, clamp nested bypasses, no credential-bearing override values, safe config keys.
- [x] T005 Write native confirmation tests in `test/approvals.test.mjs`: only object schema with zero properties/no required fields; unknown/URL/secret forms decline; no session-wide grants.
- [x] T006 Implement pure scoped policy builder in `src/tool-policy.mjs`; derived overrides never contain transport URLs, headers, environment values or credentials.
- [x] T007 Implement bounded native confirmation response in `src/approvals.mjs`; explicit local decision only, no fabricated free-form inputs.

## Phase 3 — US1 inherited capabilities (P1)
Goal: production-capable inherited environment with unchanged Jarvis presentation.
Independent test: real enabled catalogs + tool execution evidence, no provider-specific implementation.
- [x] T008 [US1] Replace spawn/disable-all policy in `src/codex.mjs`; keep hard-coded loopback and scoped human reviewer/read-only shell restrictions.
- [x] T009 [US1] Apply refreshed policy on create/resume in `src/engine.mjs`; preserve session/thread/idempotency/history.
- [x] T010 [US1] Add bounded tool evidence to `src/engine.mjs` and local-only inspection in `src/server.mjs`/`scripts/ctl.mjs`: last 64 metadata records, no arguments/results/auth data.
- [x] T011 [US1] Add sanitized reusable inventory runner in `scripts/tool-parity-inventory.mjs` and native validation runner in `scripts/tool-parity-smoke.mjs`.
- [ ] T012 [US1] Validate Gmail/Drive/GitHub/MCP/skill reads through production gateway and record `specs/004-ale-453-tool-parity/validation.md`; distinguish physical evidence.

## Phase 4 — US2 explicit owner approvals (P1)
Goal: native write confirmations reach Jarvis as pending and wait for a specific local owner decision.
Independent test: no side effect on decline/timeout/disconnect; explicit accept authorizes one operation.
- [x] T013 [US2] Add integration tests in `test/integration.test.mjs` for pending/accept/decline/expiry/stale turn/disconnect/unknown request, snapshot credential exclusion.
- [x] T014 [US2] Extend `src/engine.mjs` local approval lifecycle for supported MCP confirmation; only active matching thread/turn requests eligible, each UUID resolves once.
- [x] T015 [US2] Prove native write gating with harmless diagnostic MCP in `scripts/tool-parity-smoke.mjs` before production activation.
- [ ] T016 [US2] Verify actual Gmail draft request waits, then after explicit owner approval verify draft creation via production; record `specs/004-ale-453-tool-parity/validation.md`. Never send mail.

## Phase 5 — US3 dynamic configuration (P2)
Goal: reflect native capability changes on restart without provider code or lost conversation.
Independent test: isolated disable/re-enable and production same-thread recovery.
- [x] T017 [US3] Test configuration reload and user-disabled server/plugin persistence in `test/tool-policy.test.mjs` and `test/integration.test.mjs`.
- [x] T018 [US3] Validate disable/re-enable across isolated native restarts in `scripts/tool-parity-smoke.mjs`, preserving global user config.

## Phase 6 — Delivery and acceptance
- [x] T019 Update `ARCHITECTURE.md`, `RUNBOOK.md`, `docs/setup-status.md` with supported surface, approval limits and evidence.
- [x] T020 Run root/AIUI checks, real app-server smoke, secret scan and diff review; record `specs/004-ale-453-tool-parity/validation.md`.
- [ ] T021 Deploy gateway with preserved state/IDs/tunnel/private config and record rollback/readiness in `specs/004-ale-453-tool-parity/validation.md`; Linear Needs Test.
- [ ] T022 Execute physical Jarvis read/skill/MCP/draft acceptance with wearer and record results in `specs/004-ale-453-tool-parity/validation.md` and Linear; Done only if accepted.

## Dependencies/execution

T001–T003 precede runtime modifications. T004/T005 fail before implementation T006/T007. US1 and US2
implementation are coupled at production safety gate: do not deploy enabled tools before approval
negative tests and native proof. US3 follows working policy. Production reads follow T020/T021; T016
requires separate owner approval. T022 requires wearer interaction.

Parallel opportunities (optional, no extra agents required): pure policy and approval tests touch
separate files; inventory documentation can proceed alongside isolated native proof. All engine edits
and production restarts are sequential. MVP is US1+US2 together; US1 without approvals is not releasable.
