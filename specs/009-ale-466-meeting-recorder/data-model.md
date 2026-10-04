# Data model

Recording: UUID id; owner is server-side device identity; format `pcm16` or `opus`;
PCM always mono 16 kHz little-endian; createdAt; state derived as open or closed;
closure contains chunkCount, complete boolean, reason. Explicit 2-hour maximum.
Chunk: sequence integer 0..29999; bytes 1..65536; kind audio/header; durationMs finite >0..10000 for audio, 0 for Opus header;
sha256 hexadecimal digest; PCM duration must equal bytes/32. Immutable numbered records.
Store maximum 256 MiB encoded archive across sessions, including metadata; session count <=32.
Disk directory is private and owned by the process; hostile local filesystem writers are outside scope.
One store instance/process owns a root. Restart verifies every chunk checksum/order before ACK.
Transcript: ordered segments with integer id, numeric startMs/endMs and bounded text; no guessed speaker.
Result: summary/decisions/actions arrays; each item has text and nonempty segmentIds; actions
have owner/dueDate strings or null. Length, evidence indices and unknown fields are validated.
Delivery receipt: provider identity and readback result, kept locally; uncertain outcome requires manual
reconciliation rather than retry. No provider credentials/receipt data belong in Git.
