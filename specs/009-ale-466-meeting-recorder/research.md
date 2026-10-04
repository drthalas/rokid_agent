# Research and decisions — 2026-10-04

## Recorder
Primary source: [official API](https://github.com/yodaos-project/AIUI/blob/b1e9ff620b41b306bd50ef87d401f32d6c57edb5/documentation/3-api/media/media-capture.en-US.md),
[official sample](https://github.com/yodaos-project/AIUI/blob/b1e9ff620b41b306bd50ef87d401f32d6c57edb5/samples/capabilities/pages/recorder/index.ink).
Read-only research delegated by the Spec Kit plan workflow.

Decision: register callbacks before start; frameSize=1000 means milliseconds. PCM frames are raw,
WAV header removed. Opus `onHeader(format, buffer)` precedes frames; preserve it as sequence zero
with kind=header and duration=0. `isLastFrame` is always false; onStop follows remaining frames and
is the completion barrier. stop/start return promises. No tempfile (tempFilePath=''). The official
sample combines Opus header+frames into audio/ogg; do not assume each frame is independently decodable.
No documented maximum duration/background guarantee. Prototype is foreground-only, interruption
stops incomplete. Physical lifecycle/thermal/microphone contention remain release gates.

## Transport/storage
Decision: HTTPS request/ACK per immutable numbered chunk, one flight, explicit reconnect retry;
loopback-only test server. WSS could reduce overhead but adds no necessary semantics for this proof.
Use private file records and atomic fsync+rename, reconstruct on restart. No production routes.
No persistent device spool claim; bounded memory overflow stops incomplete. Master is generated only
for closed, complete PCM, and archive preserves exact Opus header/payload bytes for later decoding.

## Transcription/results
Decision: reuse merged ALE-470 `Stt` locally, sequential bounded PCM WAV windows with absolute
segment offsets. Production Whisper contract unchanged. Chunk-boundary context and diarization
remain quality work. Inject a text-only summarizer, require evidence references and explicit unknown
owner/date. This validates output shape/provenance links, not semantic truth of a model claim.
No native app-server client or provider tools are added to the summarizer.

## Provider capability
Current Gmail connector exposes a MIME tree, not a local-path attachment argument. Synthetic MIME
attachment draft is therefore the directly tested capability; existing historical local-path evidence
must not be relabeled as this schema. Drive upload_file schema has contradictory prose but string
file_uri explicitly accepts absolute local path; synthetic local text upload succeeded. Exact readback
and limits recorded in evidence.md. This session's connectors do not prove availability from the
production app-server account/runtime. No email send and no sharing operation.
