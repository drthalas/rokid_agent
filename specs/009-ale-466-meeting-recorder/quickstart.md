# Local verification

From repository root, Node >=22:

```sh
node --test test/meeting-*.test.mjs
npm test
```

Tests create synthetic data in fresh OS temporary directories, use random credentials and ephemeral
loopback HTTPS ports, and remove their data. They do not start `npm start`, use production config,
connect to app-server, or package AIUI. See [contract](contracts/recording.md) for limits.

For local STT use `processRecording(store, id, owner, {stt})` with an explicitly constructed `Stt`
using a local whisper-cli/model path. Never load private production configuration. PCM is supported;
Opus processing rejects until a verified decoder/container adapter is provided. Summary generation
uses `summarize(transcript, textOnlyAdapter)` and validates the returned JSON.

Do not connect real glasses or real meeting data to this prototype. Physical acceptance, consent/
retention decisions, Opus framing, production integration and approval require a later session.

Synthetic-only real STT smoke (macOS `say` with Milena, ffmpeg, existing whisper.cpp/model):

```sh
node prototypes/meeting/smoke.mjs /absolute/whisper-cli /absolute/ggml-large-v3-turbo.bin
```

The script generates its own speech, tests 65 seconds / three windows, prints only synthetic results,
and deletes all temporary audio. It cannot accept a real recording path. Native speech synthesis,
Metal and loopback tests may require the usual sandbox approval; never disable TLS or auth to test.
