// Correlation/idempotency IDs only: never credentials or approval grants.
// Preserve native UUIDs when available. Older Ink has no crypto global.
let lastTime = -1;
let sequence = 0;
export function requestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const now = Date.now();
  if (now > lastTime) { lastTime = now; sequence = 0; }
  else if (++sequence > 0xfff) { lastTime++; sequence = 0; }
  // UUIDv7-shaped fallback: logical time + counter prevent same-VM collisions,
  // random tail separates runtimes. Unpredictability is not an auth boundary.
  const time = lastTime.toString(16).padStart(12, '0');
  const tail = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const variant = (8 + (parseInt(tail[0], 16) & 3)).toString(16);
  return time.slice(0, 8) + '-' + time.slice(8) + '-7' + sequence.toString(16).padStart(3, '0') +
    '-' + variant + tail.slice(1, 4) + '-' + tail.slice(4);
}
