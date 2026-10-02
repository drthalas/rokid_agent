# Rokid Agent

The product-facing RV101 agent is **Jarvis**, invoked with “Hi Rokid, Jarvis”.

A personal voice terminal: **Rokid RV101 → AIUI → authenticated HTTPS → Mac gateway → loopback Codex app-server**. Follow-up commands retain the selected project's Codex thread; results return to HUD and optional native TTS. AIUI is primary; direct Android APK and Nexus are optional fallbacks.

[GitHub main](https://github.com/drthalas/rokid_agent/tree/main) is the source of truth. The backend chain has user-reported physical success; the new temple UX still requires physical acceptance. See [current setup, tests and limitations](docs/setup-status.md).

## Start here

- [Product brief](docs/project-brief.md) — goals, scope and acceptance.
- [Canonical architecture](ARCHITECTURE.md) — boundaries, protocol, security, decisions and migration gaps.
- [Context map](docs/context-map.md) — route into code/docs for a specific task.
- [Development workflow](docs/development-workflow.md) — checks, private deployment and Spec Kit use.
- [Mac runbook](RUNBOOK.md), [AIUI setup](AIUI_SETUP.md), [historical test evidence](TEST_RESULTS.md), [licenses/notices](THIRD_PARTY_NOTICES.md).

## Local setup

Requires macOS, Node 22+, local Codex already authenticated, and local whisper.cpp/model for short audio STT.

```sh
git clone https://github.com/drthalas/rokid_agent.git
cd rokid_agent
npm ci
npm run setup
```

Run setup only on a fresh checkout. Configure project allowlist/default in the generated private configuration, then `npm start`; follow the [runbook](RUNBOOK.md). Never expose app-server or admin API to the network.

For a fresh AIUI checkout: `npm --prefix aiui-agent ci`, then create ignored `aiui-agent/config.js` from [the safe example](aiui-agent/config.example.js). Do not overwrite an existing private config. Configure trusted HTTPS and private packaging through [AIUI setup](AIUI_SETUP.md).

## Checks and deployment

`npm test` checks the gateway; `npm --prefix aiui-agent test` and `npm --prefix aiui-agent run check` check AIUI. Real `npm run smoke` uses the local account and leaves a test thread; run it for relevant integration changes. Android checks and AIX packaging are documented in the linked runbooks. Documentation-only edits do not require inference or physical tests.

Test locally → configure private AIX → authorized cloud upload/repackage/save → download and verify active AIX → Hi Rokid resource update → physical acceptance. GitHub does not automatically deploy AIUI. The HTTP deploy script's full unattended path remains unverified; use the documented cloud fallback where necessary.

## Security

Never commit private `config.js`, tokens, account/browser state, certificates/private keys, logs or configured/cloud AIX. Safe examples are tracked; private builds remain readable and must not be published. Project allowlist is routing, not multi-tenant isolation; dangerous actions require local explicit approval. [Security model](ARCHITECTURE.md#security-and-persistence) defines the boundaries.

Current scope is short interactive commands. Meeting capture, camera/vision and persistent actions require future specifications; they are not implemented features.
