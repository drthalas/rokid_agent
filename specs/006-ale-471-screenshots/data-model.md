# Data model
Native image record: sessionId, turnId, itemId, SHA256, path and TTL timer. At most two current images per turn/eight globally; replacement removes oldest owned record first. No cross-turn reuse.
Desktop lease: random private directory, screenshot PNG files, absolute expiresAt. Directory0700/files0600, max8MiB/image, nonzero dimensions, successful native decode. Only generated lease directories can be cleaned.
Draft evidence: current capture identity/hash, filename/MIME/size, self-recipient equality, DRAFT label and no send observed. No image bytes, email addresses or conversation content in public evidence.
