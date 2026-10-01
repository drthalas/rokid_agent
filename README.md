# Rokid Agent

[Rokid RV101 → AIUI → Mac gateway → Codex app-server](https://github.com/drthalas/rokid_agent): a personal voice terminal that keeps the same local Codex thread across commands.

## Architecture

```text
RV101 AIUI Agent (installed through Hi Rokid on iPhone)
  → authenticated HTTPS → Mac gateway → codex app-server on 127.0.0.1
  ← task status and answer ← same persistent Codex thread
  → HUD and optional native Rokid TTS
```

The gateway owns the project allowlist, session persistence and local approvals. AIUI captures short voice commands and provides temple controls. Optional standalone Android and Nexus plugin sources are also included; the Nexus variant requires an Android phone.

- [Architecture and reference investigation](ARCHITECTURE.md)
- [macOS runbook](RUNBOOK.md)
- [AIUI setup and private deployment](AIUI_SETUP.md)
- [Test evidence and limitations](TEST_RESULTS.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Local setup

Requires macOS, Node.js 22+, and a working local Codex installation signed in under your account.

```sh
git clone https://github.com/drthalas/rokid_agent.git
cd rokid_agent
npm ci
npm run setup
```

Edit the generated `.local/config.json` to set allowed project directories and the default alias, then run `npm start`. Setup defaults to loopback. Configure an authenticated HTTPS route for the glasses as described in the runbook; never expose the Codex app-server directly. Short audio transcription uses a separately installed local `whisper.cpp` model.

Setup never overwrites existing credentials. Do not run it again on an already configured checkout.

## AIUI setup

```sh
cd aiui-agent
npm ci
cp config.example.js config.js
npm run check
```

Only copy the example on a fresh checkout: `config.js` is intentionally untracked. The empty example cannot connect until privately configured. The AIUI Studio/Craft import, account binding, packaging and **Hi Rokid → Developer → AIUI → Update glasses resources** workflow is in [AIUI_SETUP.md](AIUI_SETUP.md). It does not require an ADB cable.

Frontend 0.2.0 replaces the debug button menu with a minimal READY screen, tap-driven recording, bounded answer previews and automatic TTS. The same gateway session/thread is retained. Device gesture mapping and TTS must be validated against the actual RV101 firmware.

## Testing

From the repository root:

```sh
npm test
npm --prefix aiui-agent test
npm --prefix aiui-agent run check
npm run smoke
```

`smoke` uses the real local Codex account and a temporary project: README → TODO in the same thread, with a gateway/app-server restart between turns. It leaves the test thread in local Codex history. The other tests use fixtures/mocks. Android unit tests, build and lint commands are in [RUNBOOK.md](RUNBOOK.md).

For a credential-free AIX template, run `npm --prefix aiui-agent run pack` after creating an empty `config.js` from the example. Default packaging refuses embedded credentials. Private builds and cloud downloads stay outside Git.

## Deployment

Keep local source changes in Git; upload only a deliberately configured private build. After cloud packaging, download the active cloud AIX and verify its contents, endpoint and authentication configuration. A Studio “Synced” badge alone is insufficient proof.

`npm run deploy:rokid` prepares tests/build and implements the observed Rokid HTTP upload/save/read-back workflow. It needs an authorized Rokid session through a private token file or an already available loopback CDP endpoint. **The complete unattended HTTP upload path is not yet validated end to end.** The current verified deployment used deterministic cloud-only Playwright/CDP Repackage/Save followed by CLI download and verification. See [the deployment notes](AIUI_SETUP.md#12-deployment-без-редактирования-исходников-в-браузере) for limits and the fallback script.

GitHub is source/version history, not an automatic AIUI deployment trigger. No GitHub → AIUI sync is assumed.

## Security

Never commit `aiui-agent/config.js`, `.local/`, `.env*`, private AIX files, device/admin tokens, Rokid sessions, browser profiles, logs or private keys. `config.example.js` and `connection.example.json` contain no live credentials. Runtime/generated artifacts are ignored.

Bearer authentication protects the gateway; Codex and the admin interface remain on loopback. Project aliases are allowlisted. Dangerous operations are not automatically approved; a separate decision is made on the Mac. Read-only sandboxing and a cwd allowlist do not provide complete multi-tenant filesystem isolation.

A privately configured AIX contains a readable device token. Keep it private in Rokid Cloud and never submit that build to the public store. A Quick Tunnel URL is temporary; recreating the tunnel requires reconfiguration/redeployment. TLS verification remains enabled on AIUI; the explicitly authorized smoke-only origin exception is documented in the setup guide.

## Current status

- Physical backend chain AIUI → gateway → Codex → Done has been confirmed.
- Cloud UX version **1.0.8** was downloaded and verified against the new frontend code and private configuration.
- The last UX validation passed 18 AIUI tests and 13 root tests; Android builds/tests were also verified in the first iteration.
- Physical acceptance of the new temple controls and automatic TTS remains pending. Do not equate a passing package build with a completed device test.

This MVP targets interactive commands, not meeting recording or long transcription.
