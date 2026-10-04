# Tasks: ALE-466 prototype

## Setup and foundation
- [x] T001 Verify current main and canonical Linear scope; write specs/009-ale-466-meeting-recorder/spec.md.
- [x] T002 Research RecorderManager and provider contracts in specs/009-ale-466-meeting-recorder/research.md.
- [x] T003 Define private storage and transport contract in specs/009-ale-466-meeting-recorder/contracts/recording.md.

## US1 — Capture/recover (MVP)
Independent test: simulated 60-minute capture, lost ACK/restart, exact replay and failure checks.
- [x] T004 [US1] Implement prototypes/meeting/store.mjs: UUID, 64 KiB chunks, 2-hour limit, 256 MiB store, 32 sessions, durable sequential ACK.
- [x] T005 [US1] Implement prototypes/meeting/transport.mjs: owner-bound loopback HTTPS, 96 KiB body bound, strict TLS client.
- [x] T006 [US1] Implement prototypes/meeting/capture.mjs: 8 MiB queue, Opus header, onStop barrier, reconnect, interruption and overflow.
- [x] T007 [US1] Verify test/meeting-capture.test.mjs and test/meeting-store.test.mjs including restart and long capture.

## US2 — Process recording
Independent test: fixture transcript, synthetic PCM speech and malformed summary rejection.
- [x] T008 [US2] Implement prototypes/meeting/process.mjs: streaming PCM master, bounded local STT, timestamped transcript, evidence-linked summary and actions.
- [x] T009 [US2] Verify test/meeting-process.test.mjs and isolated real local STT; record evidence in specs/009-ale-466-meeting-recorder/evidence.md.

## US3 — Provider proof
Independent test: synthetic local file readback and unsent draft attachment readback.
- [x] T010 [US3] Record Gmail/Drive capability proof and account/runtime limitations in specs/009-ale-466-meeting-recorder/evidence.md.

## Checkpoint
- [x] T011 Run root tests, review new files/diff, scan index/reachable history; record specs/009-ale-466-meeting-recorder/evidence.md.
- [x] T012 Update Linear and commit/push coherent branch checkpoint; stop before rollout.

Dependencies: T001–T003 → T004–T007 → T008–T009 → T011–T012. T010 can run independently
alongside US1/US2. Within US1 store and injected capture can be tested separately after contract;
within US2 summary validation and PCM fixtures can be prepared independently. No concurrent writes
to feature state. Deliver MVP first, then processing and capability evidence, never deploy in this phase.

Deferred feature gates (not checkpoint tasks): physical RV101 recording/stop/lifecycle; Opus decode;
production integration and native Codex/provider capability; quality/diarization; consent/retention UX.

Delivery receipt (commit SHA, remote verification and final Linear update) is recorded in the canonical ALE-466 checkpoint comment; completion applies to this prototype phase only.
