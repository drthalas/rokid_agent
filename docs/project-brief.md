# Project brief

## Problem and user

The owner wears Rokid RV101 and wants short voice interactions with a personal Codex agent on a continuously available Mac mini, retaining project context between utterances. The owner uses an iPhone; an Android phone is not required for the primary AIUI path.

## First useful scenario

Open “Hi Rokid, Mac Codex”, tap and ask to describe the selected project's README. Read/hear the response; tap and ask for the main TODOs. Both prompts must use the same Codex thread. The selected project is an allowlisted alias; hazardous actions require a separate local Mac decision.

## Current scope and success criteria

- Private AIUI deployment through Studio/Craft and Hi Rokid; short explicit voice capture, Mac STT, authenticated HTTPS, HUD and optional native TTS.
- Mac gateway checks Codex availability, chooses an allowlisted project, creates/resumes sessions and retains thread identity across follow-ups/restart.
- Primary acceptance: READY → tap/LISTENING → tap/transcribe/THINKING/WORKING → DONE; visible answer and independently verified automatic TTS; next utterance same thread; cancel, close and reconnect without duplicate submission.
- Optional direct Android APK and Nexus clients share gateway contracts; their own physical validation is separate.

Current product/task status is maintained in [Linear Rokid_agent](https://linear.app/drthalas/project/rokid-agent-8d46c39dc1d2). [Setup status](setup-status.md) preserves dated environment/test evidence; physical acceptance is not inferred from these requirements or a package build.

## Non-goals for the current MVP

No meeting recording, long transcription, camera/vision processing, notification service or persistent autonomous actions. No multi-tenant platform, automatic dangerous-action approvals, public credential-bearing agent, or rewrite of upstream hubs. Camera permission alone does not implement camera capability.

## Constraints and established decisions

macOS/Node 22+, existing local Codex account, loopback-only app-server, separate authenticated device gateway, allowlisted project selection, private credentials/artifacts, explicit short capture and same-thread continuity. AIUI is primary; Android clients are fallback. [Architecture](../ARCHITECTURE.md) and its ADRs own technical decisions. GitHub main owns reviewed source; a cloud edit or package is not the source of truth.

## Open product questions

- Firmware/Hi Rokid versions and actual new-UX gesture/TTS behavior: resolve during the next physical acceptance run.
- Camera/meeting consent, retention, deletion and processing location: resolve before those feature specifications are approved.
- Persistent-action permissions, notifications, latency/availability targets and cost budget: resolve with the first feature requiring them. No numeric SLO or multi-user scope is assumed.
