# Context map

Read the relevant row, not every document on every task.

| Task | Canonical context / implementation |
|---|---|
| Product intent / scope | [Project brief](project-brief.md) |
| Technical architecture / gaps | [Architecture](../ARCHITECTURE.md), [AIUI ADR](adr/ADR-001-aiui-primary.md), [network ADR](adr/ADR-002-loopback-boundary.md), [private deployment ADR](adr/ADR-003-private-deployment.md) |
| Local development / process | [Workflow](development-workflow.md), [root instructions](../AGENTS.md), [constitution](../.specify/memory/constitution.md) |
| AIUI UX / speech / HUD | [Frontend guide](../aiui-agent/README.md), [page](../aiui-agent/pages/index/index.ink), [controls](../aiui-agent/lib/voice-ui.js), [frontend client](../aiui-agent/lib/gateway.js) |
| Mac gateway / state / auth | [Server](../src/server.mjs), [engine](../src/engine.mjs), [protocol](../src/protocol.mjs), [config](../src/config.mjs) |
| Codex integration | [Adapter](../src/codex.mjs), [engine](../src/engine.mjs), [real smoke](../scripts/smoke.mjs) |
| STT / fallback clients | [STT](../src/stt.mjs), [Android sources](../android-plugin/app/src), [runbook](../RUNBOOK.md) |
| Deployment / operations | [AIUI setup](../AIUI_SETUP.md), [Mac runbook](../RUNBOOK.md), [HTTP deploy prototype](../scripts/rokid-deploy.mjs), [cloud fallback](../scripts/rokid-cloud-repackage.mjs) |
| Security / private configuration | [Architecture security](../ARCHITECTURE.md#security-and-persistence), [ADR-003](adr/ADR-003-private-deployment.md), [safe AIUI example](../aiui-agent/config.example.js), [ignore rules](../.gitignore) |
| Testing / status | [Setup status](setup-status.md), [historical test evidence](../TEST_RESULTS.md), [gateway tests](../test), [AIUI tests](../aiui-agent/test) |
| Future feature specs | [Process selection](development-workflow.md#choose-the-process), [Spec Kit readiness](setup-status.md#spec-kit), [spec template](../.specify/templates/spec-template.md) |
| Attribution | [Notices](../THIRD_PARTY_NOTICES.md), [licenses](../licenses) |

No product feature spec or `specs/` directory has been created by this bootstrap. Future specs describe intended changes, not retroactive claims that all existing behavior is desired. Installation artifacts do not establish agent discovery or hardware success.

Current bounded task: [HUD history and latency diagnosis](../specs/001-hud-history-latency/spec.md), including physical feedback, acceptance, plan and verification.
