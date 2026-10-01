# Third-party notices

This MVP is a new integration layer with narrowly adapted reference components. Full source checkouts are reproducible with `scripts/fetch-references.sh`; they are excluded from the deliverable's Git tracking.

- **Anezium/Rokid-Nexus**, commit `49128717b635783a5859dda307284f2d1eafd3eb`, root Apache-2.0 license in `licenses/Rokid-Nexus-Apache-2.0.txt`. `src/codex.mjs` adapts the loopback spawn / WebSocket initialize / RPC lifecycle pattern from `agentd/src/codex/monitor.ts`; `src/protocol.mjs` adapts approval result mapping. These are modified, reduced implementations. The Nexus Android flavor depends on its published `bus-client:sdk-v0.15.0` without copying hub code. No upstream NOTICE file was present in the checkout. Upstream agentd/package.json independently declares MIT; we preserve/disclose the root license rather than resolving that inconsistency ourselves.
- **lavAzza2/rokidhub-codex**, Copyright (c) 2026 Azat Akhmetshin, MIT in `licenses/rokidhub-codex-MIT.txt`. `CredentialStore.kt` is adapted with renamed package/storage keys and additional connection/session fields. `CommandPlanner.kt` and `VoicePluginService.kt` adapt the command dispatch and Nexus STT/HUD/TTS lifecycle. Android root Gradle configuration and wrapper files originate from this repository; wrapper distribution is adjusted to Gradle 8.11.1 for AGP 8.9.1.
- **ksuzukigh/rokid-personal-ai**, Copyright (c) 2026 Keiichi Suzuki, MIT in `licenses/rokid-personal-ai-MIT.txt`. Architectural reference for direct RV101/Mac, bounded one-shot PCM, native launcher HUD, session cleanup and effect boundaries. No unpublished AIUI code is assumed or copied; direct AudioRecord is a new Android adapter.
- **ws**, MIT, dependency pinned in package-lock.json. Its license is distributed in node_modules/ws/LICENSE after npm ci. Use 8.22.0: npm audit reported vulnerabilities in the 8.18.3 version used as the initial reference.
- **Gradle wrapper**, Apache-2.0; copyright notices are retained in gradlew. Gradle distribution contains its own licenses. APK dependencies retain upstream licenses; this project does not claim ownership of their code.
- **whisper.cpp** and a Whisper GGML model are optional runtime dependencies for the direct flavor. They are installed/downloaded separately, are not part of source distribution and retain their upstream licenses.

## AIUI frontend addition

`aiui-agent/lib/one-shot-audio.js` now includes the unmodified MIT OneShotAudioSession / PCM VAD module from rokid-personal-ai commit `23f98ff2946f7575997383929b87867503eab607` (only attribution comments added). Its tests are retained with an adjusted import path; its full license is inside the AIX. The AIUI page adapts the reference's recorder/lifecycle conventions. Official Rokid AIUI docs at commit `b1e9ff620b41b306bd50ef87d401f32d6c57edb5` and the aiui-dev skill were consulted. `@yodaos-pkg/aix-cli` 0.10.1 is a local development dependency for packaging, not bundled into the Agent. See AIUI_SETUP.md.

## Development tooling: GitHub Spec Kit

`.specify/` and `.agents/skills/speckit-*` were generated from official [github/spec-kit v1.0.13](https://github.com/github/spec-kit/tree/f1a548a39dba4e5e8600de1d2e0d3ff0c468d2a9), MIT. Full notice: [licenses/spec-kit-MIT.txt](licenses/spec-kit-MIT.txt). Constitution is project-authored; tooling is not packaged in AIUI or used by the gateway runtime.
