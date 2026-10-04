import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../lib/request-id.js', import.meta.url), 'utf8').replace('export function', 'function');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[47][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function runtime(globals) { const context = vm.createContext(globals); vm.runInContext(source, context); return context; }

test('native UUID behavior and crypto global remain untouched', () => {
  const crypto = { randomUUID() { assert.equal(this, crypto); return 'native-result'; } };
  const context = runtime({ crypto });
  assert.equal(context.requestId(), 'native-result'); assert.equal(context.crypto, crypto);
});

test('older Ink IDs stay distinct with fixed randomness, same millisecond, overflow and clock rollback', () => {
  let now = 1791100000000;
  const context = runtime({ Date: { now: () => now }, Math: { random: () => 0, floor: Math.floor } });
  const ids = Array.from({ length: 5000 }, () => context.requestId());
  now -= 1000; ids.push(context.requestId());
  assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(id => uuid.test(id)));
  assert.equal(vm.runInContext('typeof crypto', context), 'undefined');
});

test('partial crypto implementation falls back without a global polyfill', () => {
  const crypto = {}, context = runtime({ crypto });
  assert.match(context.requestId(), uuid); assert.equal(crypto.randomUUID, undefined);
});
