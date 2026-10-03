# Validation guide

Prerequisite: current stuck approval explicitly declined, same turn terminal; private config untouched.
Run `npm test`, `npm --prefix aiui-agent test`, `npm --prefix aiui-agent run check` from repository root.
Use native safe approval smoke only with isolated fixture; never accept a production prompt to test UI.
Validate private AIX using existing configure/pack workflow in AIUI_SETUP.md; do not overwrite config.js.
After authorized push/restart/private cloud repackage, download ACTIVE AIX and compare runtime/config
in memory. Record booleans only. Then wearer updates resources with Hi Rokid and tests:

Calculator20+30 → screenshot → draft-to-self attachment, never send; allow using card; repeat separate
negative checks for decline/back/timeout. Verify same session/thread, different normal turns, no replay,
TTS and restored history. Unknown forms must show cancellation, not indefinite Working. Native safe
reads/writes must continue under auto_review without additional prompts. Physical remains NOT RUN until
wearer reports it; cloud packaging cannot satisfy physical acceptance.
