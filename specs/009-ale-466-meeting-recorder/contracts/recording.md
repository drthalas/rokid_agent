# Prototype recording contract

Dedicated loopback HTTPS server, no production gateway routes. Bearer is a random prototype-only
credential mapped to one owner, never a Google/admin token. TLS verification is required. No CORS.
`PUT /recordings/<uuid>` body `{format}` creates/replays the same session; format conflict rejects.
`GET /recordings/<uuid>` returns `{nextSeq, durationMs, state, complete}` from durable storage.
`PUT /recordings/<uuid>/chunks/<seq>` JSON `{kind, durationMs, data, sha256}` uses canonical base64.
ACK `{nextSeq}` means immutable record and directory were fsynced. Only next seq is appended.
Identical retry ACKs; differing bytes/duration rejects. Gaps reject. Closed sessions reject new chunks.
`POST /recordings/<uuid>/close` `{chunkCount, complete, reason}` requires exact contiguous count.
Identical close is idempotent. Missing tail cannot be closed successfully; incomplete close remains
available for recovery/inspection but must not enter automatic processing.

Limits: 64 KiB binary chunk / 96 KiB request JSON, 10 s/chunk, 2 h/session, 32 sessions,
256 MiB store. One serialized store operation at a time; bounded HTTP concurrency rejects excess.
Fixed error codes; no bodies/transcripts/credentials/raw exception messages in logs/responses.

Capture: start only after session creation. Recorder frame callback copies bytes into bounded queue.
One upload at a time, no auto-retry storm; caller triggers `resume()` after reconnect. Lost ACK retries
same sequence/bytes. Stop calls native stop and waits for the stop callback (after final frames) before drain/
close. Interruption, error, overflow, or stop timeout closes incomplete. Foreground-only assumption;
no local persistent spool guarantee until RV101 filesystem behavior is proven. HUD state callback
provides recording/stopping/paused/complete/incomplete. Physical stop binding remains a rollout gate.

Opus frames are independent opaque blobs in a numbered archive, not asserted to be Ogg/decodable.
Opus header is kind=header, seq=0, durationMs=0; all other records are kind=audio.
PCM windows produce WAV master and bounded local transcription. No transcription through `/v1/stt`
production endpoint. Summary adapter only receives transcript data and no tools/provider authority.

Implementation limits and integration gates:
- Queue limit counts base64 payload bytes, plus at most 256 metadata entries; capture rejects after
  30,000 total records. PCM duration has sample precision (fractional milliseconds allowed).
- Opus duration currently uses nominal 1000 ms/frame, including the final frame. It is an archive
  bound, not trustworthy timestamps; real Opus granule/duration validation is a device integration gate.
- Capture controller uses Node Buffer/crypto for host tests. RV101 needs wx networking/encoding/hash
  adaptation and a physical stop/HUD binding; no claim that this module is deployable AIUI code.
- Zero-frame recordings close incomplete. Network/validation errors pause uploads until explicit
  resume; the queue remains bounded. Device process death loses unacknowledged RAM chunks.
- Storage has one process/instance writer per root, enforced by caller ownership rather than a
  cross-process lock. After filesystem write errors restart/reconstruct before retrying. Existing
  archive directory must be private and trusted. No encryption-at-rest implementation is claimed.
- Derived output uses a separate private directory per recording, with identity marker and processor
  lock. Stale crash locks require explicit local recovery after confirming no worker is running.
  Each PCM master is bounded by the recording limit; all prototype data is manually retained/deleted.
