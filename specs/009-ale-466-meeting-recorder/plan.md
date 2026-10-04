# Implementation Plan: ALE-466 Meeting Recorder

**Branch**: `codex/ale-466-meeting-prototype` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

## Summary
Build a dormant, isolated prototype under `prototypes/meeting/`. No imports from production entrypoints.
Use injected RecorderManager and transport contracts, sequential authenticated HTTPS uploads, immutable
on-disk chunks with restart reconstruction, and local PCM/Whisper transcription. Keep Opus opaque until
actual RV101 framing/container evidence exists. Summary processing accepts an injected text-only model
adapter with validated evidence links; connected Gmail/Drive get separate synthetic capability proofs.

## Technical Context
Node >=22, native fs/https/crypto/test; no new dependencies. Existing `src/stt.mjs` is reused without
modification for bounded PCM windows (ALE-470 merged in base f65d152). Dedicated temporary directories,
0600 files/0700 directories, random fixture credentials, ephemeral loopback HTTPS ports. Single writer
per recording store. 64 KiB/chunk, 8 MiB device queue, 256 MiB session/store quota, 2-hour duration.
Mac prototype API is loopback only; production integration is a later feature stage.

## Constitution Check
PASS before and after design: isolated branch/current main; no app-server/security policy changes;
owner-bound transport and private storage; no real data/credentials; mocks distinguished from physical
acceptance; no deployment. Recording privacy/retention decisions remain explicit rollout gates.

## Project Structure
- `prototypes/meeting/capture.mjs`: injected recorder/controller and bounded retry queue.
- `prototypes/meeting/store.mjs`: durable sequential archive and finalization.
- `prototypes/meeting/transport.mjs`: isolated authenticated HTTPS server/client contract.
- `prototypes/meeting/process.mjs`: PCM master/transcript/evidence-linked summary export.
- `test/meeting-*.test.mjs`: isolation, restart, failure, long-duration and processing checks.
- This directory: spec, research, data model, contracts, quickstart, tasks and evidence.

## Execution and validation
Specify → research/contract → tasks → implement capture/store/transport → processing → capability
proof → targeted tests → full root tests → diff/secrets/history review → commit/push branch checkpoint.
No production runtime or AIUI/Android file changes, so no AIX/Android builds or production smoke.
