# Data model

Approval stays memory-only: id(UUID), sessionId, turnId, rpcId, exact private native method/params,
receivedAt/expiresAt, descriptor and optional high-risk confirmation challenge. No params in snapshot.
One pending action per session; concurrent additional requests fail closed. IDs invalidated by timeout,
terminal state, native resolution, disconnect, decision or stop. Binding checked before consumption.

Device descriptor: id, turnId, kind, fixed title/description, risk(low/medium/high), allowOnGlasses=true,
expiresAt. Default pendingApproval boolean remains for older clients. Descriptor generated from a
verified known shape only, never from raw native message/reason/command/provider display fields.

Session approvalNotice: unsupported/declined/timeout; applies only to current exchange and resets on
new turn. Append fixed truthful notice to one final history answer. No pending handles persisted.

AIUI card: descriptor ID, choice=decline, second=false, confirmation=null, submitting=false,
armedAfterRender, pendingEnter timer. New ID or reopened card resets default. Selection/confirm never
stored as replayable mutation. Repeated poll does not reset choice or repeat TTS. Closed page declines
best-effort and server expiry is authoritative if network cannot deliver. High-risk first accept yields
server challenge; second deliberate selection/tap includes challenge. Neither screen defaults to accept.

## Revision additions

Exchange outcome: pending/completed/failed/interrupted/uncertain/no_answer; approvalNotice is a fixed
enum persisted on that exchange. Its assistant projection exists independently of completed=true.
FIFO approval handles preserve separate IDs/current turn; only head has shownAt/expiresAt, queued
handles cannot be accepted. Screenshot artifacts are separate memory-owned temporary paths, never
persisted in conversation/device snapshots. Fixed untrusted steering metadata is not voice history.
