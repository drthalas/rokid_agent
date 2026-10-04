# Feature Specification: ALE-466 Meeting Recorder prototype

**Feature Branch**: `codex/ale-466-meeting-prototype`
**Created**: 2026-10-04
**Status**: Prototype scope specified; production acceptance deferred
**Input**: [ALE-466](https://linear.app/drthalas/issue/ALE-466), owner comment and session request.

## User Scenarios & Testing

### User Story 1 — Capture and recover a meeting (Priority: P1)
The owner explicitly starts and stops recording and sees whether audio was saved completely.
**Why**: Lost or duplicated audio invalidates every later result.
**Independent Test**: Simulate a 60-minute recording with bounded buffers, dropped acknowledgments, reconnect and receiver restart.
**Acceptance Scenarios**:
1. Sequential audio remains byte-identical after retries and restart.
2. A gap, changed retry or unauthorized request is rejected; no complete status is shown.
3. Stop drains pending audio; interruption/overflow is marked incomplete and stops capture.

### User Story 2 — Read meeting results (Priority: P2)
The owner retains a local master and receives a timestamped transcript, summary, decisions and action items.
**Why**: Useful results must remain traceable to what was actually recorded.
**Independent Test**: Process synthetic speech and fixture transcripts, including missing speech and failed processing.
**Acceptance Scenarios**:
1. Only a completed recording is processed; failed processing retains the master and can be retried.
2. Summary items reference transcript segments; unspecified owners/dates stay unspecified. Meeting speech is untrusted data, never tool authority.
3. No diarization or physical quality claim is made without evidence.

### User Story 3 — Deliver explicitly requested results (Priority: P3)
The owner can obtain an unsent email draft and a private Drive file, through Mac-owned capabilities.
**Why**: Device credentials and accidental sends are unacceptable.
**Independent Test**: Upload a synthetic local file, read it back, create and inspect an unsent draft with attachment.
**Acceptance Scenarios**:
1. Provider success requires returned identity and readback; uncertain delivery is not automatically repeated.
2. No recipient is inferred and no email is sent. Device receives only bounded completion status.

### Edge Cases
Out-of-order chunks, conflicting duplicate, full queue, oversized frame/body, missing final frame,
recorder interruption, crash after chunk persistence but before ACK, receiver restart, disk failure,
malformed transcript/summary, provider timeout and incomplete recording.

## Requirements

### Functional Requirements
- **FR-001**: Recording is explicitly started/stopped; capture is visibly active. Prototype exposes lifecycle callbacks for later HUD binding.
- **FR-002**: Device memory, chunk size, total duration and receiver storage are bounded. Overflow stops and marks incomplete; silent gaps are forbidden.
- **FR-003**: Authenticated owner-bound sessions accept sequential chunks with durable ACK, idempotent retries, restart recovery and explicit finalization.
- **FR-004**: Mac stores the master privately and processes completed recordings locally; no Google credentials reach glasses.
- **FR-005**: Transcript preserves order/time offsets. Results distinguish summary, decisions and actions with evidence and unknown ownership/dates.
- **FR-006**: Provider operations remain explicit, draft-only for mail, and readback-verified. No background autonomous action is introduced.
- **FR-007**: Prototype never starts/modifies production gateway, changes active AIUI UI, packages/deploys AIX or uses real meeting data.
- **FR-008**: Retention is manual for this local prototype, with explicit deletion of its dedicated data directory. Production retention/consent UX is a rollout gate.

### Key Entities
Recording (owner, format, start, completeness), immutable chunk (sequence, bytes, checksum),
transcript segment (time interval, text), evidence-linked result, delivery receipt.

## Success Criteria
- **SC-001**: One simulated 60-minute session survives retries/restart with byte-identical ordered master and bounded queue.
- **SC-002**: Every tested invalid/authentication/gap/conflict case fails without declaring completion.
- **SC-003**: Synthetic speech yields a readable local transcript; fixture summary validation rejects malformed output and unknown references.
- **SC-004**: Synthetic local-file Drive upload and unsent draft can be verified, or precise capability failure is recorded.

## Assumptions
This phase proves local protocols/adapters, not on-device capture or production integration. Maximum
prototype duration is 2 hours, one owner/one active capture, 256 MiB archive quota. Opus callbacks
are archived losslessly but container/decoder compatibility needs device evidence; PCM provides a
verifiable transcription path. No speaker diarization or background capture guarantee. Owner must
review consent/retention and physical stop/HUD behavior before any real meeting use.
