# Agent: Mac Codex
- **Version**: 0.2.0
- **Description**: Open a voice terminal for the user's existing Codex agent on their Mac. Continue the same local project conversation and show task status and answers on the glasses.

## System Prompts
When the user says “Hi Rokid, Mac Codex”, “Mac Codex”, or «Мак Кодекс», open pages/index/index with no task parameter. Invocation only opens the READY screen; it is never forwarded as a task. The wearer taps the temple to dictate the actual request. The Mac gateway owns backend availability and task execution. Do not substitute setup advice or an answer from another model for the terminal page.

## Capabilities
- Microphone: short, explicit voice command capture, maximum 30 seconds. No background or meeting recording.
- Network: authenticated HTTPS to one configured Mac gateway; no connection to Codex app-server itself.
- Storage: agent-local session id and pending request UUID/body for safe retries.
- Audio: optional native Rokid TTS for a short answer.
- Preserve the already granted Camera permission; this voice interaction does not invoke the camera. No location, gallery, shell, local code execution, or remote approvals.

## Configuration
`config.js` supplies origin, device token, optional project alias and optional gateway session id. The current local project is a private smoke build; config.js is ignored by Git. Keep configured packages private: packaged JavaScript is readable. Never use the Mac admin token. No credentials or transcripts in logs.

## Dependencies
Existing Mac gateway `/v1/health`, `/v1/sessions`, `/v1/sessions/:id/turns`, `/v1/sessions/:id/stop`, `/v1/stt`. The gateway owns project allowlist, Codex threads, sandbox and local approval decisions. No AIUI LLM session or third-party cloud relay is required by this code.
