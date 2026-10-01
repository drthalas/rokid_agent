# Rokid RV101 → Codex on Mac

Interactive voice terminal with a persistent local Codex thread. Primary path for **RV101 + iPhone**: an APK runs directly on the glasses, sends short audio to local Whisper on Mac, and sends the transcript to the authenticated gateway. Optional Nexus flavor requires an Android phone.

- [AIUI installation through iPhone, without ADB](AIUI_SETUP.md)
- [Architecture and source investigation](ARCHITECTURE.md)
- [macOS / RV101 runbook](RUNBOOK.md)
- [Test evidence and limitations](TEST_RESULTS.md)
- [Reused code and license notices](THIRD_PARTY_NOTICES.md)

```sh
npm ci
npm run setup
npm start
```

Setup is initially loopback-only. Configure a LAN address, project allowlist, TLS pin and device token before connecting glasses. Codex app-server always listens on `127.0.0.1`; a separate HTTPS gateway handles device authentication. No stateless `codex exec` per prompt.

```sh
npm test
npm run smoke
```

Hardware acceptance is tracked separately from the real Mac/Codex smoke. Do not infer that an untested glasses APK works from a passing gateway test.
