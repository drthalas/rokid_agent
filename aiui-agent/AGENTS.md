# Agent: Jarvis
- **Version**: 0.6.0
- **Description**: Open a voice terminal for the user's existing Codex agent on their Mac. Continue the same local project conversation and show task status and answers on the glasses.

## System Prompts
When the user says “Hi Rokid, Jarvis”, “Jarvis”, or «Джарвис», open pages/index/index with no task parameter. Invocation only opens the READY screen; it is never forwarded as a task. The wearer taps the temple to dictate the actual request. The Mac gateway owns backend availability and task execution. Do not substitute setup advice or an answer from another model for the terminal page.

## Capabilities
- Microphone: short, explicit voice command capture, maximum 30 seconds. No background or meeting recording.
- Network: authenticated HTTPS to one configured Mac gateway; no connection to Codex app-server itself.
- Storage: agent-local session/thread identity and pending request UUID/body for retry. The Mac gateway owns the last six bounded exchanges and restores history on reopen; the frontend renders its snapshots. No conversation content in logs.
- Diagnostics: bounded timestamps, UUIDs and safe error codes only; no speech/audio/text or credentials in diagnostic uploads.
- Audio: optional native Rokid TTS for a short answer.
- Preserve the already granted Camera permission; this voice interaction does not invoke the camera. No location, gallery, shell, local code execution, or general remote execution. A separate physical approval card can decide only a gateway-validated current action. Speech never approves.

## Configuration
`config.js` supplies origin, device token, optional project alias and optional gateway session id. The current local project is a private smoke build; config.js is ignored by Git. Keep configured packages private: packaged JavaScript is readable. Never use the Mac admin token. No credentials or transcripts in logs.

## Dependencies
Existing Mac gateway `/v1/health`, `/v1/sessions`, `/v1/sessions/:id/turns`, `/v1/sessions/:id/stop`, `/v1/stt`. The gateway owns project allowlist, Codex threads, sandbox and native approval decisions. Supported current approvals use the narrow device decision endpoint; no admin API. No AIUI LLM session or third-party cloud relay is required by this code.

## Temple controls
GlobalHook is observation only and never starts/stops voice. Enter onKeyUp controls voice; arrows scroll history; Backspace keeps native back/exit. No two-finger core mapping.

## Human approval
APPROVAL defaults to ОТКЛОНИТЬ. Arrows select, Enter confirms, back declines. High-risk uses a second
default-NO screen. Maximum30s to decide; unsupported requests fail closed. Generic TTS announces once.
Cards use verified native classes (Computer Use app access, bounded commands/patches, literal turn permissions and bounded MCP confirmations), never an app-name allowlist. The actual action, target and scope must be visible. Unknown/opaque/auth/persistent grants fail closed. Failed/interrupted outcomes remain in history and are spoken once; unsupported denial immediately shows stopping feedback.
