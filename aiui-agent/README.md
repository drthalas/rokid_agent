# Mac Codex — AIUI frontend

Import this folder (or the generated AIX) into Rokid Craft / AIUI Studio. This is an **AIUI project**, not an Android APK; deployment uses the Rokid account and Hi Rokid resource update workflow, without ADB.

See [AIUI_SETUP.md](../AIUI_SETUP.md) for the full Russian setup guide.

```sh
npm ci
npm test
npm run check
# For a fresh unconfigured checkout: cp config.example.js config.js
# The default pack refuses credentials; see private deployment in AIUI_SETUP.md.
```

`../dist/mac-codex-aiui.aix` is deliberately **unconfigured and secret-free**. It shows a setup error until connected. For a working personal package, first prepare a trusted HTTPS origin for the existing Mac gateway, then follow the explicit private configuration steps in the setup guide. `config.js` is ignored and private; never force-add it to Git.

Reuse: the MIT `OneShotAudioSession` / PCM VAD module from ksuzukigh/rokid-personal-ai is retained, with its full license. Ink page and gesture conventions follow that reference and official Rokid AIUI documentation. `lib/gateway.js` maps to the existing gateway protocol without changing Mac source code. Audio is capped at 30 seconds and wrapped into WAV. Invocation opens READY without forwarding a launch prompt. Enter/GlobalHook drive capture; Backspace preserves native close.

Local storage retains the gateway session and pending mutation UUID. The same session resumes after hide/reopen; a retry never mints a new UUID for an uncertain request. A configured sessionId can attach an existing gateway session. Stop is explicit. Back/hide stops capture, TTS and polling but preserves the server task/thread.

TTS uses native `speechSynthesis.synthesize` / `SpeechAudioPlayer` automatically once per completed turn if present. These APIs allow playback to be stopped before microphone capture. Older firmware without these APIs remains text-only. Russian TTS availability is device/service dependent.

## Source evidence

- rokid-personal-ai `23f98ff2946f7575997383929b87867503eab607`: `aiui-knowledge-bridge/voice-aix-source/lib/one-shot-audio.mjs`, `pages/index/index.ink`, `prepare-voice-aix.mjs`.
- yodaos-project/AIUI `b1e9ff620b41b306bd50ef87d401f32d6c57edb5`: official framework/API docs and aiui-dev authoring guidance. No official skill files are bundled into the agent.
- Official `@yodaos-pkg/aix-cli` 0.10.1, pinned in package-lock.json. Its own licenses remain in node_modules; only runtime project files are packed.

Do not confuse successful packaging or browser preview with installation into a Rokid account or proof of physical RV101 voice behavior.

Frontend 0.2.0 removes the four-button menu. Tap while ready/done records, tap while listening sends, tap while working cancels. A short extractive answer is spoken; the full answer remains scrollable. Physical event mappings and TTS still require RV101 acceptance after resource update.
